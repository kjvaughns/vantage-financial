CREATE TABLE public.agentlink_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agentlink_links_label_length CHECK (char_length(label) BETWEEN 1 AND 100),
  CONSTRAINT agentlink_links_https_url CHECK (url ~ '^https://[^[:space:]]+$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agentlink_links TO authenticated;
GRANT ALL ON public.agentlink_links TO service_role;

ALTER TABLE public.agentlink_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uplines manage own agentlink links"
ON public.agentlink_links
FOR ALL
TO authenticated
USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

ALTER TABLE public.profiles
ADD COLUMN assigned_agentlink_link_id uuid REFERENCES public.agentlink_links(id) ON DELETE SET NULL;

CREATE INDEX agentlink_links_owner_idx ON public.agentlink_links(owner_id, is_active);
CREATE INDEX profiles_agentlink_link_idx ON public.profiles(assigned_agentlink_link_id);

CREATE POLICY "agents read assigned agentlink link"
ON public.agentlink_links
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT p.assigned_agentlink_link_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.assigned_agentlink_link_id IS NOT NULL
  )
);

CREATE TRIGGER agentlink_links_touch
BEFORE UPDATE ON public.agentlink_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.agentlink_links IS 'Upline-owned AgentLink contracting URLs assignable one per agent.';
COMMENT ON COLUMN public.profiles.assigned_agentlink_link_id IS 'The upline-owned AgentLink contracting URL assigned to this agent.';