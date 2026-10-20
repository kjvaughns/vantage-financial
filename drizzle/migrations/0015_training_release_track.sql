CREATE TABLE public.training_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  day_label text,
  position integer NOT NULL DEFAULT 0,
  video_url text,
  objective text,
  prompt text,
  instructions text,
  checklist text[] NOT NULL DEFAULT '{}',
  is_release boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_days TO authenticated;
GRANT ALL ON public.training_days TO service_role;
ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read published training days" ON public.training_days FOR SELECT TO authenticated
  USING (is_published OR public.academy_can_manage(auth.uid()));
CREATE POLICY "Managers edit training days" ON public.training_days FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

CREATE TABLE public.training_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  day_id uuid NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
  file_path text,
  link_url text,
  note text,
  status text NOT NULL DEFAULT 'submitted',
  feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_submissions_profile_idx ON public.training_submissions(profile_id, day_id);
CREATE INDEX training_submissions_status_idx ON public.training_submissions(status);
GRANT SELECT, INSERT, UPDATE ON public.training_submissions TO authenticated;
GRANT ALL ON public.training_submissions TO service_role;
ALTER TABLE public.training_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own or downline submissions" ON public.training_submissions FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_access_user(auth.uid(), profile_id));
CREATE POLICY "Submit own homework" ON public.training_submissions FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND status = 'submitted' AND reviewed_by IS NULL);
CREATE POLICY "Reviewers update downline submissions" ON public.training_submissions FOR UPDATE TO authenticated
  USING (profile_id <> auth.uid() AND public.can_access_user(auth.uid(), profile_id))
  WITH CHECK (profile_id <> auth.uid() AND public.can_access_user(auth.uid(), profile_id));

CREATE TABLE public.training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  day_id uuid NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
  approved_at timestamptz,
  approved_by uuid,
  is_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, day_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_progress TO authenticated;
GRANT ALL ON public.training_progress TO service_role;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own or downline progress" ON public.training_progress FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_access_user(auth.uid(), profile_id));
CREATE POLICY "Reviewers write downline progress" ON public.training_progress FOR ALL TO authenticated
  USING (profile_id <> auth.uid() AND public.can_access_user(auth.uid(), profile_id))
  WITH CHECK (profile_id <> auth.uid() AND public.can_access_user(auth.uid(), profile_id));

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS training_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS training_unlock_override_by uuid,
  ADD COLUMN IF NOT EXISTS release_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleared_to_call_at timestamptz;

CREATE POLICY "Training upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Training read own or downline" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-submissions' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.can_access_user(auth.uid(), ((storage.foldername(name))[1])::uuid)));

INSERT INTO public.training_days (slug, title, day_label, position, objective, prompt, instructions, checklist, is_release) VALUES
('monday', 'Intro + Needs Analysis', 'Monday', 1,
 'Open the call with confidence and run a complete needs analysis.',
 'Paste your Monday roleplay prompt here (admin: edit in Training content).',
 'Watch the lesson, copy the prompt, open ChatGPT, turn on voice mode, paste the prompt and run the roleplay. Record it (or share the chat link) and submit below.', '{}', false),
('tuesday', 'Intro + Needs Analysis + Medical + Social', 'Tuesday', 2,
 'Add the medical questions and social security step to a clean intro and needs analysis.',
 'Paste your Tuesday roleplay prompt here.',
 'Same routine as Monday: watch, copy prompt, voice mode roleplay, submit your recording.', '{}', false),
('wednesday', 'Full Presentation', 'Wednesday', 3,
 'Run the full presentation start to finish.',
 'Paste your Wednesday roleplay prompt here.',
 'Run the whole call in voice mode and submit the recording.', '{}', false),
('thursday', 'Full Presentation + Objections', 'Thursday', 4,
 'Handle common objections inside the full presentation.',
 'Paste your Thursday roleplay prompt here.',
 'Run the full call with objections and submit the recording. Passing Thursday unlocks your release call.', '{}', false),
('release', 'Release Call', 'Friday', 5,
 'Pass your live release call to get cleared to call.',
 NULL,
 'Review everything from the week, then request your release call. Your trainer will run it live and record the result.',
 ARRAY['Rewatched all four lessons','Script and rebuttals printed or open','Quiet room, headset and camera ready','Calendar open for your release call'], true);