ALTER TABLE public.profiles
  ADD COLUMN department text CHECK (department IS NULL OR char_length(department) <= 120),
  ADD COLUMN phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  ADD COLUMN semester text CHECK (semester IS NULL OR char_length(semester) <= 40),
  ADD COLUMN academic_year text CHECK (academic_year IS NULL OR char_length(academic_year) <= 40),
  ADD COLUMN staff_id text CHECK (staff_id IS NULL OR char_length(staff_id) <= 64),
  ADD COLUMN roll_number text CHECK (roll_number IS NULL OR char_length(roll_number) <= 64),
  ADD COLUMN subjects text[] NOT NULL DEFAULT '{}',
  ADD COLUMN staff_room text CHECK (staff_room IS NULL OR char_length(staff_room) <= 120),
  ADD COLUMN cleaning_area text CHECK (cleaning_area IS NULL OR char_length(cleaning_area) <= 120),
  ADD COLUMN equipment_room text CHECK (equipment_room IS NULL OR char_length(equipment_room) <= 120),
  ADD COLUMN rest_room text CHECK (rest_room IS NULL OR char_length(rest_room) <= 120),
  ADD COLUMN job_role text CHECK (job_role IS NULL OR char_length(job_role) <= 120),
  ADD COLUMN work_location text CHECK (work_location IS NULL OR char_length(work_location) <= 160),
  ADD COLUMN avatar_path text CHECK (avatar_path IS NULL OR char_length(avatar_path) <= 300);

ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('claim_received','claim_approved','claim_rejected','handover_request','item_returned','contact_request','message_received'));

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE (full_name) ON public.profiles FROM authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Users view own profile photo" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users upload own profile photo" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users replace own profile photo" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete own profile photo" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.save_my_profile(
  p_full_name text,
  p_department text,
  p_phone text,
  p_semester text,
  p_academic_year text,
  p_staff_id text,
  p_roll_number text,
  p_subjects text[],
  p_staff_room text,
  p_cleaning_area text,
  p_equipment_room text,
  p_rest_room text,
  p_job_role text,
  p_work_location text,
  p_avatar_path text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.campus_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to update your profile';
  END IF;
  IF char_length(trim(COALESCE(p_full_name, ''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Name must be between 2 and 80 characters';
  END IF;
  IF p_phone IS NOT NULL AND (char_length(trim(p_phone)) NOT BETWEEN 7 AND 40
      OR p_phone !~ '^[+()0-9 .-]+$') THEN
    RAISE EXCEPTION 'Enter a valid phone number';
  END IF;
  IF p_avatar_path IS NOT NULL AND left(p_avatar_path, char_length(auth.uid()::text) + 1)
      <> auth.uid()::text || '/' THEN
    RAISE EXCEPTION 'Profile photos must belong to your account';
  END IF;

  SELECT campus_role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF v_role = 'student' AND (
    NULLIF(trim(p_department), '') IS NULL OR NULLIF(trim(p_semester), '') IS NULL
    OR NULLIF(trim(p_academic_year), '') IS NULL OR NULLIF(trim(p_roll_number), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Students must provide roll number, department, semester, and academic year';
  ELSIF v_role = 'teacher' AND (
    NULLIF(trim(p_staff_id), '') IS NULL OR NULLIF(trim(p_department), '') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p_subjects, '{}')) AS subject(value)
      WHERE NULLIF(trim(value), '') IS NOT NULL
    ) OR NULLIF(trim(p_staff_room), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Teachers must provide staff ID, department, subjects, and staff room';
  ELSIF v_role = 'cleaning_staff' AND (
    NULLIF(trim(p_staff_id), '') IS NULL OR NULLIF(trim(p_cleaning_area), '') IS NULL
    OR NULLIF(trim(p_equipment_room), '') IS NULL OR NULLIF(trim(p_rest_room), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Cleaning staff must provide staff ID, area, equipment room, and rest room';
  ELSIF v_role IN ('security', 'other_staff') AND (
    NULLIF(trim(p_staff_id), '') IS NULL OR NULLIF(trim(p_department), '') IS NULL
    OR NULLIF(trim(p_job_role), '') IS NULL OR NULLIF(trim(p_work_location), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Staff must provide staff ID, department, job role, and work location';
  END IF;

  UPDATE public.profiles SET
    full_name = trim(p_full_name),
    department = CASE WHEN v_role IN ('student', 'teacher', 'security', 'other_staff')
      THEN NULLIF(trim(p_department), '') ELSE NULL END,
    phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
    semester = CASE WHEN v_role = 'student' THEN NULLIF(trim(p_semester), '') ELSE NULL END,
    academic_year = CASE WHEN v_role = 'student' THEN NULLIF(trim(p_academic_year), '') ELSE NULL END,
    roll_number = CASE WHEN v_role = 'student' THEN NULLIF(trim(p_roll_number), '') ELSE NULL END,
    staff_id = CASE WHEN v_role <> 'student' THEN NULLIF(trim(p_staff_id), '') ELSE NULL END,
    subjects = CASE WHEN v_role = 'teacher' THEN ARRAY(
      SELECT trim(value) FROM unnest(COALESCE(p_subjects, '{}')) AS subject(value)
      WHERE NULLIF(trim(value), '') IS NOT NULL
    ) ELSE '{}' END,
    staff_room = CASE WHEN v_role = 'teacher' THEN NULLIF(trim(p_staff_room), '') ELSE NULL END,
    cleaning_area = CASE WHEN v_role = 'cleaning_staff' THEN NULLIF(trim(p_cleaning_area), '') ELSE NULL END,
    equipment_room = CASE WHEN v_role = 'cleaning_staff' THEN NULLIF(trim(p_equipment_room), '') ELSE NULL END,
    rest_room = CASE WHEN v_role = 'cleaning_staff' THEN NULLIF(trim(p_rest_room), '') ELSE NULL END,
    job_role = CASE WHEN v_role IN ('security', 'other_staff') THEN NULLIF(trim(p_job_role), '') ELSE NULL END,
    work_location = CASE WHEN v_role IN ('security', 'other_staff') THEN NULLIF(trim(p_work_location), '') ELSE NULL END,
    avatar_path = p_avatar_path
  WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.save_my_profile(text, text, text, text, text, text, text, text[], text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_profile(text, text, text, text, text, text, text, text[], text, text, text, text, text, text, text) TO authenticated;

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES public.claims(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_updated_idx ON public.conversations(updated_at DESC);

CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_participants_user_idx ON public.conversation_participants(user_id, conversation_id);

INSERT INTO public.conversations (claim_id, item_id, status, created_at, updated_at)
SELECT claim.id, claim.item_id,
  CASE WHEN claim.status IN ('pending', 'approved', 'handover_pending') THEN 'open' ELSE 'closed' END,
  claim.created_at, claim.created_at
FROM public.claims claim
ON CONFLICT (claim_id) DO NOTHING;
INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT conversation.id, claim.claimant_id
FROM public.conversations conversation
JOIN public.claims claim ON claim.id = conversation.claim_id
UNION
SELECT conversation.id, item.reporter_id
FROM public.conversations conversation
JOIN public.items item ON item.id = conversation.item_id
ON CONFLICT DO NOTHING;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text text NOT NULL CHECK (char_length(trim(message_text)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX messages_conversation_created_idx ON public.messages(conversation_id, created_at);
CREATE INDEX messages_unread_idx ON public.messages(conversation_id, read_at) WHERE read_at IS NULL;

CREATE TABLE public.meeting_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location text NOT NULL CHECK (char_length(trim(location)) BETWEEN 2 AND 160),
  starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'cancelled', 'replaced')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_proposals_conversation_idx ON public.meeting_proposals(conversation_id, created_at DESC);
CREATE UNIQUE INDEX one_pending_meeting_per_conversation
  ON public.meeting_proposals(conversation_id) WHERE status = 'proposed';

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversations, public.conversation_participants, public.messages, public.meeting_proposals FROM PUBLIC, anon;
GRANT SELECT ON public.conversations, public.conversation_participants, public.messages, public.meeting_proposals TO authenticated;
GRANT INSERT (conversation_id, sender_id, message_text) ON public.messages TO authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  );
$$;
CREATE OR REPLACE FUNCTION public.can_send_conversation_message(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_conversation_participant(p_conversation_id) AND EXISTS (
    SELECT 1 FROM public.conversations co
    JOIN public.claims cl ON cl.id = co.claim_id
    WHERE co.id = p_conversation_id AND co.status = 'open'
      AND cl.status IN ('pending', 'approved', 'handover_pending')
      AND co.item_id = cl.item_id
  );
$$;
REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_send_conversation_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_conversation_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_chat_profile_photo(p_photo_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.conversation_participants viewer
    JOIN public.conversation_participants owner
      ON owner.conversation_id = viewer.conversation_id
    JOIN public.profiles profile ON profile.id = owner.user_id
    WHERE viewer.user_id = auth.uid() AND profile.avatar_path = p_photo_path
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_chat_profile_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_chat_profile_photo(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.suggest_conversation_meeting(
  p_conversation_id uuid,
  p_location text,
  p_starts_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meeting_id uuid;
BEGIN
  IF NOT public.can_send_conversation_message(p_conversation_id) THEN
    RAISE EXCEPTION 'Only active claim participants can suggest a meeting';
  END IF;
  IF char_length(trim(COALESCE(p_location, ''))) NOT BETWEEN 2 AND 160
      OR p_starts_at <= now() THEN
    RAISE EXCEPTION 'Enter a meeting location and a future date and time';
  END IF;
  UPDATE public.meeting_proposals SET status = 'replaced'
  WHERE conversation_id = p_conversation_id AND status = 'proposed';
  INSERT INTO public.meeting_proposals (conversation_id, proposed_by, location, starts_at)
  VALUES (p_conversation_id, auth.uid(), trim(p_location), p_starts_at)
  RETURNING id INTO v_meeting_id;
  RETURN v_meeting_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_conversation_meeting(
  p_meeting_id uuid,
  p_action text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meeting public.meeting_proposals%ROWTYPE;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('accept', 'cancel') THEN
    RAISE EXCEPTION 'Choose accept or cancel';
  END IF;
  SELECT * INTO v_meeting FROM public.meeting_proposals WHERE id = p_meeting_id FOR UPDATE;
  IF NOT FOUND OR v_meeting.status <> 'proposed'
      OR NOT public.can_send_conversation_message(v_meeting.conversation_id) THEN
    RAISE EXCEPTION 'This meeting suggestion is no longer available';
  END IF;
  IF p_action = 'accept' THEN
    IF v_meeting.proposed_by = auth.uid() THEN
      RAISE EXCEPTION 'The person who suggested the meeting cannot accept it';
    END IF;
    UPDATE public.meeting_proposals SET status = 'accepted' WHERE id = p_meeting_id;
  ELSE
    UPDATE public.meeting_proposals SET status = 'cancelled' WHERE id = p_meeting_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_conversation_meeting(uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_conversation_meeting(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_conversation_meeting(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_conversation_meeting(uuid, text) TO authenticated;

CREATE POLICY "Participants read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (public.is_conversation_participant(id));
CREATE POLICY "Users see their own participant rows" ON public.conversation_participants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Participants read conversation messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id));
CREATE POLICY "Participants send messages in active claims" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND public.can_send_conversation_message(conversation_id)
  );
CREATE POLICY "Recipients mark messages read" ON public.messages
  FOR UPDATE TO authenticated USING (
    sender_id <> auth.uid() AND public.is_conversation_participant(conversation_id)
  ) WITH CHECK (
    sender_id <> auth.uid() AND read_at IS NOT NULL
      AND public.is_conversation_participant(conversation_id)
  );
CREATE POLICY "Participants read meeting proposals" ON public.meeting_proposals
  FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id));
CREATE POLICY "Participants view chat profile photos" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'profile-photos'
    AND public.can_view_chat_profile_photo(name)
  );

CREATE OR REPLACE FUNCTION public.create_conversation_for_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conversation_id uuid;
  v_reporter_id uuid;
BEGIN
  SELECT reporter_id INTO v_reporter_id FROM public.items WHERE id = NEW.item_id;
  INSERT INTO public.conversations (claim_id, item_id)
  VALUES (NEW.id, NEW.item_id)
  ON CONFLICT (claim_id) DO NOTHING
  RETURNING id INTO v_conversation_id;
  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id FROM public.conversations WHERE claim_id = NEW.id;
  END IF;
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, NEW.claimant_id), (v_conversation_id, v_reporter_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER claims_create_conversation
  AFTER INSERT ON public.claims FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_claim();
REVOKE ALL ON FUNCTION public.create_conversation_for_claim() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.close_conversation_for_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET status = CASE WHEN NEW.status IN ('pending', 'approved', 'handover_pending') THEN 'open' ELSE 'closed' END,
      updated_at = now()
  WHERE claim_id = NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER claims_sync_conversation_status
  AFTER UPDATE OF status ON public.claims FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.close_conversation_for_claim();
REVOKE ALL ON FUNCTION public.close_conversation_for_claim() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET updated_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_touch_conversation
  AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();
REVOKE ALL ON FUNCTION public.touch_conversation_on_message() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_conversation_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, kind, claim_id, item_id)
  SELECT participant.user_id, 'message_received', conversation.claim_id, conversation.item_id
  FROM public.conversations conversation
  JOIN public.conversation_participants participant
    ON participant.conversation_id = conversation.id
  WHERE conversation.id = NEW.conversation_id AND participant.user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_notify_recipient
  AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_message();
REVOKE ALL ON FUNCTION public.notify_conversation_message() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS TABLE (
  conversation_id uuid,
  claim_id uuid,
  item_id uuid,
  item_title text,
  item_photo_path text,
  item_status public.item_status,
  claim_status public.claim_status,
  conversation_status text,
  other_user_id uuid,
  other_name text,
  other_role public.campus_role,
  other_department text,
  other_avatar_path text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT co.id, cl.id, i.id, i.title, i.photo_url, i.status, cl.status, co.status,
    other_participant.user_id, p.full_name, p.campus_role, p.department, p.avatar_path,
    latest.message_text, latest.created_at,
    (SELECT count(*) FROM public.messages unread
      WHERE unread.conversation_id = co.id AND unread.sender_id <> auth.uid() AND unread.read_at IS NULL)
  FROM public.conversations co
  JOIN public.claims cl ON cl.id = co.claim_id
  JOIN public.items i ON i.id = co.item_id
  JOIN public.conversation_participants own_participant
    ON own_participant.conversation_id = co.id AND own_participant.user_id = auth.uid()
  JOIN public.conversation_participants other_participant
    ON other_participant.conversation_id = co.id AND other_participant.user_id <> auth.uid()
  JOIN public.profiles p ON p.id = other_participant.user_id
  LEFT JOIN LATERAL (
    SELECT m.message_text, m.created_at FROM public.messages m
    WHERE m.conversation_id = co.id ORDER BY m.created_at DESC LIMIT 1
  ) latest ON true
  WHERE auth.uid() IS NOT NULL
  ORDER BY COALESCE(latest.created_at, co.updated_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_conversations() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_claim_summaries()
RETURNS TABLE (
  claim_id uuid,
  item_id uuid,
  item_title text,
  item_kind public.item_kind,
  claim_status public.claim_status,
  is_claimant boolean,
  item_status public.item_status,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cl.id, i.id, i.title, i.kind, cl.status, cl.claimant_id = auth.uid(), i.status, cl.created_at
  FROM public.claims cl JOIN public.items i ON i.id = cl.item_id
  WHERE auth.uid() IS NOT NULL AND (cl.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
  ORDER BY cl.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_claim_summaries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_claim_summaries() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meeting_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_proposals;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;