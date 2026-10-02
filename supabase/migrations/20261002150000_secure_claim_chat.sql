CREATE TYPE public.conversation_status AS ENUM ('active', 'closed', 'archived');
CREATE TYPE public.meeting_status AS ENUM ('proposed', 'accepted', 'declined');

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES public.claims(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  status public.conversation_status NOT NULL DEFAULT 'active',
  meeting_location text CHECK (meeting_location IS NULL OR char_length(trim(meeting_location)) BETWEEN 2 AND 160),
  meeting_at timestamptz,
  meeting_status public.meeting_status,
  meeting_proposed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  meeting_responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_meeting_details_check CHECK (
    meeting_status IS NULL OR (meeting_location IS NOT NULL AND meeting_at IS NOT NULL)
  )
);
CREATE INDEX conversations_item_created_idx ON public.conversations(item_id, created_at DESC);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT INSERT (claim_id, item_id) ON public.conversations TO authenticated;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text text NOT NULL CHECK (char_length(trim(message_text)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX messages_conversation_created_idx
  ON public.messages(conversation_id, created_at DESC, id DESC);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT INSERT (conversation_id, sender_id, message_text) ON public.messages TO authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_kind_check,
  ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD CONSTRAINT notifications_kind_check CHECK (
    kind IN ('claim_received', 'claim_approved', 'claim_rejected', 'handover_request',
      'item_returned', 'contact_request', 'chat_message')
  );
CREATE INDEX notifications_conversation_unread_idx
  ON public.notifications(conversation_id, recipient_id, created_at DESC)
  WHERE conversation_id IS NOT NULL AND read_at IS NULL;

CREATE OR REPLACE FUNCTION public.can_access_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.conversations AS cv
    JOIN public.claims AS c ON c.id = cv.claim_id
    JOIN public.items AS i ON i.id = c.item_id AND i.id = cv.item_id
    WHERE cv.id = p_conversation_id
      AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid() OR public.is_campus_staff())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_claim_conversation(p_claim_id uuid, p_item_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.claims AS c
    JOIN public.items AS i ON i.id = c.item_id
    WHERE c.id = p_claim_id
      AND c.item_id = p_item_id
      AND c.status IN ('pending', 'approved', 'handover_pending')
      AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid() OR public.is_campus_staff())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_send_conversation_message(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.conversations AS cv
    JOIN public.claims AS c ON c.id = cv.claim_id
    JOIN public.items AS i ON i.id = c.item_id AND i.id = cv.item_id
    WHERE cv.id = p_conversation_id
      AND cv.status = 'active'
      AND c.status IN ('pending', 'approved', 'handover_pending')
      AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_conversation_summary(p_conversation_id uuid)
RETURNS TABLE (
  item_id uuid,
  item_title text,
  item_photo_path text,
  claim_status public.claim_status,
  conversation_status public.conversation_status,
  other_display_name text,
  meeting_location text,
  meeting_at timestamptz,
  meeting_status public.meeting_status,
  meeting_proposed_by uuid,
  is_workflow_participant boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.title, i.photo_url, c.status, cv.status,
    CASE
      WHEN auth.uid() = c.claimant_id THEN COALESCE(NULLIF(i.reporter_name, ''), 'Item reporter')
      WHEN auth.uid() = i.reporter_id THEN COALESCE(NULLIF(split_part(p.full_name, ' ', 1), ''), 'Claimant')
      ELSE 'Claim participants'
    END,
    cv.meeting_location, cv.meeting_at, cv.meeting_status, cv.meeting_proposed_by,
    (auth.uid() = c.claimant_id OR auth.uid() = i.reporter_id)
  FROM public.conversations AS cv
  JOIN public.claims AS c ON c.id = cv.claim_id
  JOIN public.items AS i ON i.id = c.item_id AND i.id = cv.item_id
  LEFT JOIN public.profiles AS p ON p.id = c.claimant_id
  WHERE cv.id = p_conversation_id
    AND public.can_access_conversation(cv.id);
$$;

REVOKE ALL ON FUNCTION public.can_access_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_create_claim_conversation(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_send_conversation_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_claim_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_conversation_message(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversation_summary(uuid) TO authenticated;

CREATE POLICY "Claim participants and staff read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (public.can_access_conversation(id));
CREATE POLICY "Claim participants create conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (
    public.can_create_claim_conversation(claim_id, item_id)
  );

CREATE POLICY "Conversation participants and staff read messages" ON public.messages
  FOR SELECT TO authenticated USING (public.can_access_conversation(conversation_id));
CREATE POLICY "Participants send messages to active conversations" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND public.can_send_conversation_message(conversation_id)
  );
CREATE POLICY "Participants mark received messages read" ON public.messages
  FOR UPDATE TO authenticated USING (
    sender_id <> auth.uid()
    AND read_at IS NULL
    AND public.can_access_conversation(conversation_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS cv
      JOIN public.claims AS c ON c.id = cv.claim_id
      JOIN public.items AS i ON i.id = c.item_id
      WHERE cv.id = conversation_id
        AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
    )
  ) WITH CHECK (
    sender_id <> auth.uid()
    AND read_at IS NOT NULL
    AND public.can_access_conversation(conversation_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS cv
      JOIN public.claims AS c ON c.id = cv.claim_id
      JOIN public.items AS i ON i.id = c.item_id
      WHERE cv.id = conversation_id
        AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.create_conversation_for_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pending', 'approved', 'handover_pending') THEN
    INSERT INTO public.conversations (claim_id, item_id)
    VALUES (NEW.id, NEW.item_id)
    ON CONFLICT (claim_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER claims_create_conversation
  AFTER INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_claim();
REVOKE ALL ON FUNCTION public.create_conversation_for_claim() FROM PUBLIC, anon, authenticated;

INSERT INTO public.conversations (claim_id, item_id, status)
SELECT c.id, c.item_id,
  CASE WHEN c.status = 'returned' THEN 'closed'::public.conversation_status
    ELSE 'active'::public.conversation_status END
FROM public.claims AS c
WHERE c.status IN ('pending', 'approved', 'handover_pending', 'returned')
ON CONFLICT (claim_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.close_conversation_after_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('rejected', 'returned') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.conversations
    SET status = 'closed', updated_at = now()
    WHERE claim_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER claims_close_conversation
  AFTER UPDATE OF status ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.close_conversation_after_claim();
REVOKE ALL ON FUNCTION public.close_conversation_after_claim() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_conversation_after_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET updated_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_touch_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_after_message();
REVOKE ALL ON FUNCTION public.touch_conversation_after_message() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_conversation_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claimant_id uuid;
  v_reporter_id uuid;
  v_item_id uuid;
BEGIN
  SELECT c.claimant_id, i.reporter_id, i.id
  INTO v_claimant_id, v_reporter_id, v_item_id
  FROM public.conversations AS cv
  JOIN public.claims AS c ON c.id = cv.claim_id
  JOIN public.items AS i ON i.id = c.item_id
  WHERE cv.id = NEW.conversation_id;

  INSERT INTO public.notifications (recipient_id, kind, claim_id, item_id, conversation_id)
  SELECT DISTINCT recipients.user_id, 'chat_message',
    (SELECT claim_id FROM public.conversations WHERE id = NEW.conversation_id),
    v_item_id, NEW.conversation_id
  FROM (VALUES (v_claimant_id), (v_reporter_id)) AS recipients(user_id)
  WHERE recipients.user_id IS NOT NULL AND recipients.user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_notify_participants
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_message();
REVOKE ALL ON FUNCTION public.notify_conversation_message() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.propose_conversation_meeting(
  p_conversation_id uuid,
  p_location text,
  p_meeting_at timestamptz
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_send_conversation_message(p_conversation_id) THEN
    RAISE EXCEPTION 'Only conversation participants can propose a meeting';
  END IF;
  IF p_location IS NULL OR char_length(trim(p_location)) NOT BETWEEN 2 AND 160 OR p_meeting_at IS NULL
    OR p_meeting_at <= now() OR p_meeting_at > now() + interval '180 days' THEN
    RAISE EXCEPTION 'Enter a valid future meeting place and time';
  END IF;

  UPDATE public.conversations
  SET meeting_location = trim(p_location),
      meeting_at = p_meeting_at,
      meeting_status = 'proposed',
      meeting_proposed_by = auth.uid(),
      meeting_responded_by = NULL,
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_conversation_meeting(
  p_conversation_id uuid,
  p_response public.meeting_status
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposer uuid;
BEGIN
  IF p_response IS NULL OR p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Choose accept or decline';
  END IF;
  IF NOT public.can_access_conversation(p_conversation_id)
    OR NOT public.can_send_conversation_message(p_conversation_id) THEN
    RAISE EXCEPTION 'Only conversation participants can respond to a meeting';
  END IF;

  SELECT meeting_proposed_by INTO v_proposer
  FROM public.conversations
  WHERE id = p_conversation_id AND meeting_status = 'proposed'
  FOR UPDATE;
  IF NOT FOUND OR v_proposer = auth.uid() THEN
    RAISE EXCEPTION 'Only the other participant can respond to this proposal';
  END IF;
  UPDATE public.conversations
  SET meeting_status = p_response,
      meeting_responded_by = auth.uid(),
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_conversation_meeting(uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_conversation_meeting(uuid, public.meeting_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_conversation_meeting(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_conversation_meeting(uuid, public.meeting_status) TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'Supabase Realtime publication is not available';
  END IF;

  FOREACH v_table IN ARRAY ARRAY['messages', 'notifications', 'conversations'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$$;