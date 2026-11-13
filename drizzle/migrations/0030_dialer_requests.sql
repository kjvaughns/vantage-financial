CREATE TABLE public.dialer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  agent_name text NOT NULL,
  lead_types text[] NOT NULL DEFAULT '{}',
  states text[] NOT NULL DEFAULT '{}',
  sheet_row integer,
  status text NOT NULL DEFAULT 'requested',
  dialer_username text,
  has_password boolean NOT NULL DEFAULT false,
  last_change text NOT NULL DEFAULT 'new',
  changed_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dialer_requests TO authenticated;
GRANT ALL ON public.dialer_requests TO service_role;
ALTER TABLE public.dialer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin read dialer requests" ON public.dialer_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));