CREATE OR REPLACE FUNCTION public.can_claim_item(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.items AS i
    WHERE i.id = p_item_id
      AND i.kind = 'found'
      AND i.status = 'open'
      AND i.is_hidden = false
      AND i.reporter_id <> auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_contact_about_item(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.items AS i
    WHERE i.id = p_item_id
      AND i.status <> 'returned'
      AND i.is_hidden = false
      AND i.reporter_id <> auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_claim_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_contact_about_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_claim_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_contact_about_item(uuid) TO authenticated;

DROP POLICY IF EXISTS "Claim participants and staff read claims" ON public.claims;
CREATE POLICY "Claim participants and staff read claims" ON public.claims
  FOR SELECT TO authenticated USING (
    claimant_id = auth.uid()
    OR public.is_item_reporter(item_id)
    OR public.is_campus_staff()
  );

DROP POLICY IF EXISTS "Signed-in users request claims on found items" ON public.claims;
CREATE POLICY "Signed-in users request claims on found items" ON public.claims
  FOR INSERT TO authenticated WITH CHECK (
    claimant_id = auth.uid()
    AND status = 'pending'
    AND public.can_claim_item(item_id)
  );

DROP POLICY IF EXISTS "Claim participants and staff read handovers" ON public.handovers;
CREATE POLICY "Claim participants and staff read handovers" ON public.handovers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.claims AS c
      WHERE c.id = claim_id
        AND (c.claimant_id = auth.uid() OR public.is_item_reporter(c.item_id))
    ) OR public.is_campus_staff()
  );

DROP POLICY IF EXISTS "Request participants and staff read contact requests" ON public.contact_requests;
CREATE POLICY "Request participants and staff read contact requests" ON public.contact_requests
  FOR SELECT TO authenticated USING (
    requester_id = auth.uid()
    OR public.is_item_reporter(item_id)
    OR public.is_campus_staff()
  );

DROP POLICY IF EXISTS "Signed-in users send private contact requests" ON public.contact_requests;
CREATE POLICY "Signed-in users send private contact requests" ON public.contact_requests
  FOR INSERT TO authenticated WITH CHECK (
    requester_id = auth.uid()
    AND public.can_contact_about_item(item_id)
  );

DROP POLICY IF EXISTS "Participants leave feedback after return" ON public.feedback;
CREATE POLICY "Participants leave feedback after return" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.claims AS c
      WHERE c.id = claim_id
        AND c.status = 'returned'
        AND (c.claimant_id = auth.uid() OR public.is_item_reporter(c.item_id))
    )
  );