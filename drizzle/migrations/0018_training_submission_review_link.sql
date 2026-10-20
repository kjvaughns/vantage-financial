ALTER TABLE public.training_submissions ADD COLUMN review_id uuid;
CREATE INDEX training_submissions_review_idx ON public.training_submissions(review_id);
COMMENT ON COLUMN public.training_submissions.review_id IS 'Call Coach review auto-created for this homework recording.';