CREATE TABLE public.training_reviewers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.training_reviewers TO authenticated;
GRANT ALL ON public.training_reviewers TO service_role;
ALTER TABLE public.training_reviewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage training reviewers" ON public.training_reviewers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "See own reviewer grant" ON public.training_reviewers FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_training_reviewer(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.training_reviewers WHERE user_id = _uid)
$$;

CREATE POLICY "Training reviewers see all submissions" ON public.training_submissions FOR SELECT TO authenticated USING (public.is_training_reviewer(auth.uid()));
CREATE POLICY "Training reviewers update submissions" ON public.training_submissions FOR UPDATE TO authenticated
  USING (profile_id <> auth.uid() AND public.is_training_reviewer(auth.uid()))
  WITH CHECK (profile_id <> auth.uid() AND public.is_training_reviewer(auth.uid()));
CREATE POLICY "Training reviewers see all progress" ON public.training_progress FOR SELECT TO authenticated USING (public.is_training_reviewer(auth.uid()));
CREATE POLICY "Training reviewers write progress" ON public.training_progress FOR ALL TO authenticated
  USING (profile_id <> auth.uid() AND public.is_training_reviewer(auth.uid()))
  WITH CHECK (profile_id <> auth.uid() AND public.is_training_reviewer(auth.uid()));
CREATE POLICY "Training reviewers see homework reviews" ON public.call_reviews FOR SELECT TO authenticated
  USING (source = 'homework' AND public.is_training_reviewer(auth.uid()));
CREATE POLICY "Training reviewers read call recordings" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'call-recordings' AND public.is_training_reviewer(auth.uid()));