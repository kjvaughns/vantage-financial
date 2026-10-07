ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS builder_priorities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS builder_priority_other text,
  ADD COLUMN IF NOT EXISTS agency_bottleneck text,
  ADD COLUMN IF NOT EXISTS agency_help_needed text;

COMMENT ON COLUMN public.applicants.team_size IS 'Builder downline count or Owner active writer count, according to agency_track.';
COMMENT ON COLUMN public.applicants.builder_priorities IS 'Selected Builder priorities: leads, systems, training, leadership, compensation, or other.';