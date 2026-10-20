CREATE TABLE public.coach_reference_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_doc_id text,
  content text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_reference_scripts TO authenticated;
GRANT ALL ON public.coach_reference_scripts TO service_role;
ALTER TABLE public.coach_reference_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read scripts" ON public.coach_reference_scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage scripts" ON public.coach_reference_scripts FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.coach_reference_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  media_path text,
  media_url text,
  provider_job_id text,
  status text NOT NULL DEFAULT 'queued',
  transcript_text text,
  error text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_reference_calls TO authenticated;
GRANT ALL ON public.coach_reference_calls TO service_role;
ALTER TABLE public.coach_reference_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reference calls" ON public.coach_reference_calls FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.coach_settings (
  id boolean PRIMARY KEY DEFAULT true,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  rubric_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_score_for_approval integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_settings_singleton CHECK (id)
);
GRANT SELECT, INSERT, UPDATE ON public.coach_settings TO authenticated;
GRANT ALL ON public.coach_settings TO service_role;
ALTER TABLE public.coach_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read coach settings" ON public.coach_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write coach settings" ON public.coach_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.coach_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.call_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  title text NOT NULL,
  call_type text NOT NULL DEFAULT 'roleplay',
  source text NOT NULL DEFAULT 'upload',
  media_path text,
  media_url text,
  provider_job_id text,
  status text NOT NULL DEFAULT 'queued',
  transcript_text text,
  transcript jsonb,
  pillar_scores jsonb,
  overall integer,
  summary text,
  improvements jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_reviews_profile_idx ON public.call_reviews(profile_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_reviews TO authenticated;
GRANT ALL ON public.call_reviews TO service_role;
ALTER TABLE public.call_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own or downline call reviews" ON public.call_reviews FOR SELECT TO authenticated USING (profile_id = auth.uid() OR public.can_access_user(auth.uid(), profile_id) OR public.is_admin(auth.uid()));
CREATE POLICY "Create own call reviews" ON public.call_reviews FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Delete own call reviews" ON public.call_reviews FOR DELETE TO authenticated USING (profile_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.call_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.call_reviews(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.call_review_comments TO authenticated;
GRANT ALL ON public.call_review_comments TO service_role;
ALTER TABLE public.call_review_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read comments on visible reviews" ON public.call_review_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.call_reviews r WHERE r.id = review_id));
CREATE POLICY "Comment on visible reviews" ON public.call_review_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.call_reviews r WHERE r.id = review_id));
CREATE POLICY "Delete own comments" ON public.call_review_comments FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Upload own call recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'call-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Read own or downline call recordings" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'call-recordings' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()) OR public.can_access_user(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Admins upload reference recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'call-recordings' AND (storage.foldername(name))[1] = 'reference' AND public.is_admin(auth.uid()));