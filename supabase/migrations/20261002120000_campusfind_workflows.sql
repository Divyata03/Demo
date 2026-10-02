CREATE TYPE public.claim_status AS ENUM ('pending','approved','rejected','handover_pending','returned');
CREATE TYPE public.staff_access AS ENUM ('staff','admin');

ALTER TABLE public.items
  ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

CREATE TABLE public.campus_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level public.staff_access NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campus_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campus_staff FROM anon, authenticated;
GRANT ALL ON public.campus_staff TO service_role;

CREATE OR REPLACE FUNCTION public.is_campus_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.campus_staff WHERE user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_campus_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campus_staff
    WHERE user_id = auth.uid() AND access_level = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_campus_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_campus_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_campus_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_campus_admin() TO authenticated;

CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  claimant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_details text NOT NULL CHECK (char_length(verification_details) BETWEEN 10 AND 2000),
  status public.claim_status NOT NULL DEFAULT 'pending',
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  reviewer_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE UNIQUE INDEX one_active_claim_per_item ON public.claims(item_id)
  WHERE status IN ('pending','approved','handover_pending');
CREATE INDEX claims_claimant_created_idx ON public.claims(claimant_id, created_at DESC);
CREATE INDEX claims_item_created_idx ON public.claims(item_id, created_at DESC);
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.claims TO authenticated;
GRANT INSERT (item_id, claimant_id, verification_details) ON public.claims TO authenticated;
CREATE POLICY "Claim participants and staff read claims" ON public.claims
  FOR SELECT TO authenticated USING (
    claimant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.items i WHERE i.id = item_id AND i.reporter_id = auth.uid())
    OR public.is_campus_staff()
  );
CREATE POLICY "Signed-in users request claims on found items" ON public.claims
  FOR INSERT TO authenticated WITH CHECK (
    claimant_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = item_id AND i.kind = 'found' AND i.status = 'open'
        AND i.is_hidden = false AND i.reporter_id <> auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.mark_item_claimed_on_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.items SET status = 'claimed' WHERE id = NEW.item_id AND status = 'open';
  RETURN NEW;
END; $$;
CREATE TRIGGER claims_mark_item_claimed
  AFTER INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.mark_item_claimed_on_request();

CREATE TABLE public.handovers (
  claim_id uuid PRIMARY KEY REFERENCES public.claims(id) ON DELETE CASCADE,
  claimant_confirmed boolean NOT NULL DEFAULT false,
  finder_confirmed boolean NOT NULL DEFAULT false,
  staff_confirmed boolean NOT NULL DEFAULT false,
  evidence text CHECK (evidence IS NULL OR char_length(evidence) <= 1000),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.handovers TO authenticated;
CREATE POLICY "Claim participants and staff read handovers" ON public.handovers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.items i ON i.id = c.item_id
      WHERE c.id = claim_id
        AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
    ) OR public.is_campus_staff()
  );

CREATE TABLE public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_requests_item_created_idx ON public.contact_requests(item_id, created_at DESC);
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.contact_requests TO authenticated;
GRANT INSERT (item_id, requester_id, message) ON public.contact_requests TO authenticated;
CREATE POLICY "Request participants and staff read contact requests" ON public.contact_requests
  FOR SELECT TO authenticated USING (
    requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.items i WHERE i.id = item_id AND i.reporter_id = auth.uid())
    OR public.is_campus_staff()
  );
CREATE POLICY "Signed-in users send private contact requests" ON public.contact_requests
  FOR INSERT TO authenticated WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = item_id AND i.reporter_id <> auth.uid()
        AND i.status <> 'returned' AND i.is_hidden = false
    )
  );

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, author_id)
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.feedback TO authenticated;
GRANT INSERT (claim_id, author_id, rating, comment) ON public.feedback TO authenticated;
CREATE POLICY "Authors and staff read private feedback" ON public.feedback
  FOR SELECT TO authenticated USING (author_id = auth.uid() OR public.is_campus_staff());
CREATE POLICY "Participants leave feedback after return" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.items i ON i.id = c.item_id
      WHERE c.id = claim_id AND c.status = 'returned'
        AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
    )
  );

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('claim_received','claim_approved','claim_rejected','handover_request','item_returned','contact_request')),
  claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notifications_recipient_created_idx ON public.notifications(recipient_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_claim_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.items%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (recipient_id, kind, claim_id, item_id)
    VALUES (v_item.reporter_id, 'claim_received', NEW.id, NEW.item_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (recipient_id, kind, claim_id, item_id)
      VALUES (NEW.claimant_id, 'claim_approved', NEW.id, NEW.item_id),
        (v_item.reporter_id, 'handover_request', NEW.id, NEW.item_id);
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (recipient_id, kind, claim_id, item_id)
      VALUES (NEW.claimant_id, 'claim_rejected', NEW.id, NEW.item_id);
    ELSIF NEW.status = 'returned' THEN
      INSERT INTO public.notifications (recipient_id, kind, claim_id, item_id)
      VALUES (NEW.claimant_id, 'item_returned', NEW.id, NEW.item_id),
        (v_item.reporter_id, 'item_returned', NEW.id, NEW.item_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER claims_notify_change
  AFTER INSERT OR UPDATE OF status ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.notify_claim_change();

CREATE OR REPLACE FUNCTION public.notify_contact_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reporter uuid;
BEGIN
  SELECT reporter_id INTO v_reporter FROM public.items WHERE id = NEW.item_id;
  INSERT INTO public.notifications (recipient_id, kind, item_id)
  VALUES (v_reporter, 'contact_request', NEW.item_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER contact_request_notify
  AFTER INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request();

CREATE OR REPLACE FUNCTION public.review_claim(p_claim_id uuid, p_approved boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claim public.claims%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_campus_staff() THEN
    RAISE EXCEPTION 'Only authorized campus staff can review claims';
  END IF;
  SELECT * INTO v_claim FROM public.claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND OR v_claim.status <> 'pending' THEN
    RAISE EXCEPTION 'This claim is no longer pending';
  END IF;
  UPDATE public.claims
  SET status = CASE WHEN p_approved THEN 'approved'::public.claim_status ELSE 'rejected'::public.claim_status END,
      review_note = NULLIF(left(COALESCE(p_note, ''), 1000), ''),
      reviewer_id = auth.uid(), reviewed_at = now()
  WHERE id = p_claim_id;
  UPDATE public.items SET status = CASE WHEN p_approved THEN 'claimed'::public.item_status ELSE 'open'::public.item_status END
  WHERE id = v_claim.item_id;
  IF p_approved THEN
    INSERT INTO public.handovers (claim_id) VALUES (p_claim_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_handover(p_claim_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claim public.claims%ROWTYPE;
v_reporter uuid;
BEGIN
  SELECT c.* INTO v_claim FROM public.claims c WHERE c.id = p_claim_id FOR UPDATE;
  IF NOT FOUND OR v_claim.status NOT IN ('approved','handover_pending') THEN
    RAISE EXCEPTION 'This claim is not ready for handover';
  END IF;
  SELECT reporter_id INTO v_reporter FROM public.items WHERE id = v_claim.item_id;
  IF auth.uid() = v_claim.claimant_id THEN
    UPDATE public.handovers SET claimant_confirmed = true WHERE claim_id = p_claim_id;
  ELSIF auth.uid() = v_reporter THEN
    UPDATE public.handovers SET finder_confirmed = true WHERE claim_id = p_claim_id;
  ELSE
    RAISE EXCEPTION 'Only the claimant or item reporter can confirm';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.handovers
    WHERE claim_id = p_claim_id AND claimant_confirmed AND finder_confirmed
  ) THEN
    UPDATE public.claims SET status = 'handover_pending' WHERE id = p_claim_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.save_handover_evidence(p_claim_id uuid, p_evidence text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.claims c JOIN public.items i ON i.id = c.item_id
    WHERE c.id = p_claim_id AND c.status IN ('approved','handover_pending')
      AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
  ) AND NOT public.is_campus_staff() THEN
    RAISE EXCEPTION 'Only handover participants can add evidence';
  END IF;
  UPDATE public.handovers SET evidence = NULLIF(left(COALESCE(p_evidence, ''), 1000), '')
  WHERE claim_id = p_claim_id;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_handover(p_claim_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_campus_staff() THEN
    RAISE EXCEPTION 'Only authorized campus staff can complete handover';
  END IF;
  SELECT item_id INTO v_item_id FROM public.claims
  WHERE id = p_claim_id AND status = 'handover_pending' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.handovers
    WHERE claim_id = p_claim_id AND claimant_confirmed AND finder_confirmed
  ) THEN
    RAISE EXCEPTION 'Both parties must confirm before handover can be completed';
  END IF;
  UPDATE public.handovers SET staff_confirmed = true, completed_at = now()
  WHERE claim_id = p_claim_id;
  UPDATE public.claims SET status = 'returned' WHERE id = p_claim_id;
  UPDATE public.items SET status = 'returned' WHERE id = v_item_id;
END; $$;

CREATE OR REPLACE FUNCTION public.moderate_item(p_item_id uuid, p_hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_campus_staff() THEN
    RAISE EXCEPTION 'Only authorized campus staff can moderate items';
  END IF;
  UPDATE public.items SET is_hidden = p_hidden WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.save_profile_name(p_full_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR char_length(trim(p_full_name)) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Name must be between 2 and 80 characters';
  END IF;
  UPDATE public.profiles SET full_name = trim(p_full_name) WHERE id = auth.uid();
END; $$;

REVOKE ALL ON FUNCTION public.review_claim(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_handover(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_handover_evidence(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_handover(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_item(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_profile_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_claim(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_handover(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_handover_evidence(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_handover(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_item(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_profile_name(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_item_reporter(p_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.items WHERE id = p_item_id AND reporter_id = auth.uid()
  );
$$;
CREATE OR REPLACE FUNCTION public.get_my_items()
RETURNS TABLE (
  id uuid,
  kind public.item_kind,
  title text,
  category text,
  description text,
  photo_url text,
  location text,
  occurred_at timestamptz,
  reporter_name text,
  reporter_role public.campus_role,
  status public.item_status,
  created_at timestamptz,
  is_hidden boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.kind, i.title, i.category, i.description, i.photo_url, i.location,
    i.occurred_at, i.reporter_name, i.reporter_role, i.status, i.created_at, i.is_hidden
  FROM public.items i
  WHERE auth.uid() IS NOT NULL AND i.reporter_id = auth.uid()
  ORDER BY i.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.is_item_reporter(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_items() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_item_reporter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_items() TO authenticated;

DROP POLICY "Anyone can browse items" ON public.items;
CREATE POLICY "Anyone can browse visible items" ON public.items
  FOR SELECT TO anon USING (is_hidden = false);
CREATE POLICY "Signed-in users browse visible items and staff moderate" ON public.items
  FOR SELECT TO authenticated USING (is_hidden = false OR public.is_campus_staff());
CREATE POLICY "Reporters read their own hidden items" ON public.items
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.items FROM authenticated;
GRANT INSERT (kind, title, category, description, photo_url, location, occurred_at) ON public.items TO authenticated;
GRANT UPDATE (title, category, description, photo_url, location, occurred_at) ON public.items TO authenticated;
DROP POLICY "Reporter updates own items" ON public.items;
CREATE POLICY "Reporter edits own item details" ON public.items
  FOR UPDATE TO authenticated USING (auth.uid() = reporter_id) WITH CHECK (auth.uid() = reporter_id);
DROP POLICY "Reporter deletes own items" ON public.items;

CREATE OR REPLACE FUNCTION public.redact_item_description(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(trim(regexp_replace(
    regexp_replace(
      regexp_replace(COALESCE(p_value, ''), '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[email removed]', 'gi'),
      '(\+?[0-9][0-9 .()/-]{6,}[0-9])', '[phone or ID removed]', 'g'
    ),
    '((college|campus|student)[[:space:]]+(id|number|no\.?)[[:space:]]*[:#-]?[[:space:]]*[[:alnum:]-]+)', '[private ID removed]', 'gi'
  )), '');
$$;
CREATE OR REPLACE FUNCTION public.redact_item_description_before_save() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.description := public.redact_item_description(NEW.description);
  RETURN NEW;
END; $$;
CREATE TRIGGER redact_item_description_trg
  BEFORE INSERT OR UPDATE OF description ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.redact_item_description_before_save();
UPDATE public.items SET description = public.redact_item_description(description)
WHERE description IS NOT NULL;
REVOKE ALL ON FUNCTION public.redact_item_description(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redact_item_description_before_save() FROM PUBLIC, anon, authenticated;

REVOKE SELECT ON public.items FROM anon, authenticated;
GRANT SELECT (id, kind, title, category, description, photo_url, location, occurred_at, reporter_name, reporter_role, status, created_at)
  ON public.items TO anon;
GRANT SELECT (id, kind, title, category, description, photo_url, location, occurred_at, reporter_name, reporter_role, status, created_at, is_hidden)
  ON public.items TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

DROP POLICY "Users upload own item photos" ON storage.objects;
CREATE POLICY "Users upload own item photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'item-photos' AND owner_id = auth.uid()::text
  );
DROP POLICY "Users delete own item photos" ON storage.objects;
CREATE POLICY "Users delete own item photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'item-photos'
    AND (owner_id = auth.uid()::text OR (storage.foldername(name))[1] = auth.uid()::text)
  );

