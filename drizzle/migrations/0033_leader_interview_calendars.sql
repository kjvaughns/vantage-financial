CREATE TABLE public.interview_calendars (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.profiles(id),
 username text NOT NULL,
 event_slug text NOT NULL,
 event_type_id integer NOT NULL,
 timezone text NOT NULL DEFAULT 'America/Chicago',
 encrypted_api_key text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.interview_calendars TO service_role;
ALTER TABLE public.interview_calendars ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX interview_calendars_active_owner ON public.interview_calendars(owner_id) WHERE enabled;
ALTER TABLE public.applicants ADD COLUMN interview_calendar_id uuid REFERENCES public.interview_calendars(id);
COMMENT ON TABLE public.interview_calendars IS 'Server-only encrypted calendar credentials; retired versions retained for booking rescheduling. No browser or anonymous access.';