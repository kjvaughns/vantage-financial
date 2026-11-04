ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS exam_format text;
ALTER TABLE public.applicants ADD CONSTRAINT applicants_exam_format_valid CHECK (exam_format IS NULL OR exam_format IN ('online', 'in_person'));
COMMENT ON COLUMN public.applicants.exam_format IS 'Licensing exam delivery format: online or in_person.';