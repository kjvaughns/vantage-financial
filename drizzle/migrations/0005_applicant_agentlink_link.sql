ALTER TABLE public.applicants
  ADD COLUMN assigned_agentlink_link_id uuid REFERENCES public.agentlink_links(id) ON DELETE SET NULL;

CREATE INDEX applicants_agentlink_link_idx ON public.applicants(assigned_agentlink_link_id);

COMMENT ON COLUMN public.applicants.assigned_agentlink_link_id IS 'Pending upline-owned AgentLink contracting link, copied to the profile on promotion to agent.';