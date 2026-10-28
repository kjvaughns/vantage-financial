ALTER TABLE public.applicants ADD COLUMN upline_override_id uuid REFERENCES public.profiles(id);
CREATE OR REPLACE FUNCTION public.assign_applicant_upline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND ((TG_OP='INSERT' AND NEW.upline_override_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.upline_override_id IS DISTINCT FROM OLD.upline_override_id)) THEN RAISE EXCEPTION 'Manual upline changes require the authorized hierarchy action'; END IF;
 NEW.assigned_manager_id := coalesce(NEW.upline_override_id,public.resolve_applicant_upline(coalesce(NEW.assigned_recruiter_id,NEW.referred_by_profile_id,NEW.original_recruiter_id)));
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.change_reporting_upline(_actor uuid,_target uuid,_kind text,_upline uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE elevated boolean; allowed boolean; target_profile uuid; a public.applicants%ROWTYPE; chosen uuid; link_id uuid; old_upline uuid;
BEGIN
 elevated := public.is_admin(_actor);
 IF NOT elevated AND NOT (public.has_role(_actor,'leader') OR public.has_role(_actor,'manager')) THEN RAISE EXCEPTION 'Only leaders can change uplines'; END IF;
 IF _upline IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_upline AND p.is_active AND (public.has_role(p.id,'leader') OR public.has_role(p.id,'manager') OR public.is_admin(p.id))) THEN RAISE EXCEPTION 'Choose an active leader'; END IF;
  IF NOT elevated AND _upline<>_actor AND NOT public.is_descendant(_actor,_upline) THEN RAISE EXCEPTION 'Choose a leader within your organization'; END IF;
 END IF;
 IF _kind='applicant' THEN
  SELECT * INTO a FROM public.applicants WHERE id=_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Applicant not found'; END IF;
  allowed := elevated OR a.assigned_manager_id=_actor OR public.is_descendant(_actor,a.assigned_manager_id) OR a.assigned_recruiter_id=_actor OR public.is_descendant(_actor,a.assigned_recruiter_id) OR a.referred_by_profile_id=_actor OR public.is_descendant(_actor,a.referred_by_profile_id);
  target_profile:=a.portal_profile_id; old_upline:=a.assigned_manager_id;
  chosen:=coalesce(_upline,public.resolve_applicant_upline(coalesce(a.assigned_recruiter_id,a.referred_by_profile_id,a.original_recruiter_id)));
 ELSIF _kind='profile' THEN
  PERFORM 1 FROM public.profiles WHERE id=_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found'; END IF;
  IF _upline IS NULL THEN RAISE EXCEPTION 'Choose an upline'; END IF;
  target_profile:=_target; chosen:=_upline;
  allowed:=elevated OR (_target<>_actor AND public.is_descendant(_actor,_target));
  SELECT parent_user_id INTO old_upline FROM public.profiles WHERE id=_target;
 ELSE RAISE EXCEPTION 'Invalid target'; END IF;
 IF NOT coalesce(allowed,false) THEN RAISE EXCEPTION 'You can only move people within your organization'; END IF;
 IF target_profile IS NOT NULL AND chosen IS NOT NULL AND (target_profile=chosen OR public.is_descendant(target_profile,chosen)) THEN RAISE EXCEPTION 'That move would create a hierarchy loop'; END IF;
 SELECT CASE WHEN count(*)=1 THEN (array_agg(id))[1] END INTO link_id FROM public.agentlink_links WHERE owner_id=chosen AND is_active;
 IF target_profile IS NOT NULL THEN
  UPDATE public.profiles SET parent_user_id=chosen,manager_id=chosen,assigned_agentlink_link_id=link_id WHERE id=target_profile;
 END IF;
 IF _kind='applicant' THEN
  UPDATE public.applicants SET upline_override_id=_upline,assigned_agentlink_link_id=link_id WHERE id=_target;
 ELSE
  UPDATE public.applicants SET upline_override_id=_upline,assigned_agentlink_link_id=link_id WHERE portal_profile_id=target_profile;
 END IF;
 INSERT INTO public.audit_logs(action,actor_id,target_user_id,target_applicant_id,previous_value,new_value) VALUES('upline_changed',_actor,target_profile,CASE WHEN _kind='applicant' THEN _target ELSE NULL END,jsonb_build_object('upline',old_upline),jsonb_build_object('upline',chosen,'manual',_upline IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.change_reporting_upline(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.change_reporting_upline(uuid,uuid,text,uuid) TO service_role;