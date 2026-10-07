ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS applicant_type text NOT NULL DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS agency_track text,
  ADD COLUMN IF NOT EXISTS team_size integer,
  ADD COLUMN IF NOT EXISTS monthly_production text,
  ADD COLUMN IF NOT EXISTS current_imo text,
  ADD COLUMN IF NOT EXISTS agency_goals text;
CREATE INDEX IF NOT EXISTS applicants_applicant_type_idx ON public.applicants(applicant_type);