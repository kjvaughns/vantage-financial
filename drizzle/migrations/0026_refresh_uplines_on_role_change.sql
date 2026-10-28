CREATE OR REPLACE FUNCTION public.refresh_uplines_after_role_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _user uuid := coalesce(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.applicants a
  SET assigned_manager_id = public.resolve_applicant_upline(coalesce(a.assigned_recruiter_id, a.referred_by_profile_id, a.original_recruiter_id)),
      assigned_agentlink_link_id = NULL
  WHERE a.upline_override_id IS NULL
    AND (a.assigned_recruiter_id = _user OR public.is_descendant(_user, a.assigned_recruiter_id)
         OR a.referred_by_profile_id = _user OR public.is_descendant(_user, a.referred_by_profile_id))
    AND a.assigned_manager_id IS DISTINCT FROM public.resolve_applicant_upline(coalesce(a.assigned_recruiter_id, a.referred_by_profile_id, a.original_recruiter_id));
  RETURN coalesce(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.refresh_uplines_after_role_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER user_roles_refresh_uplines AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.refresh_uplines_after_role_change();
COMMENT ON FUNCTION public.refresh_uplines_after_role_change() IS 'When a user gains or loses a leader/manager/admin role, re-resolve automatic uplines for applicants in their organization so the new leader AgentLink contracting link is used; manual upline overrides are preserved.';