DROP POLICY IF EXISTS "hierarchy reads downline applicants" ON public.applicants;
CREATE POLICY "hierarchy reads downline applicants" ON public.applicants FOR SELECT TO authenticated
USING (public.is_descendant(auth.uid(), assigned_recruiter_id) OR public.is_descendant(auth.uid(), original_recruiter_id) OR public.is_descendant(auth.uid(), referred_by_profile_id));
CREATE POLICY "referrer reads own referred applicants" ON public.applicants FOR SELECT TO authenticated
USING (referred_by_profile_id = auth.uid());
CREATE INDEX IF NOT EXISTS applicants_referred_by_idx ON public.applicants(referred_by_profile_id);
DROP POLICY IF EXISTS "Signed-in read scripts" ON public.coach_reference_scripts;
DROP POLICY IF EXISTS "Signed-in read coach settings" ON public.coach_settings;