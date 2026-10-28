CREATE OR REPLACE FUNCTION public.refresh_hierarchy_uplines() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.parent_user_id IS NOT DISTINCT FROM OLD.parent_user_id AND NEW.manager_id IS NOT DISTINCT FROM OLD.manager_id THEN RETURN NEW; END IF;
 UPDATE public.applicants a SET assigned_manager_id=public.resolve_applicant_upline(coalesce(a.assigned_recruiter_id,a.referred_by_profile_id,a.original_recruiter_id)), assigned_agentlink_link_id=NULL
 WHERE a.upline_override_id IS NULL AND a.assigned_manager_id IS DISTINCT FROM public.resolve_applicant_upline(coalesce(a.assigned_recruiter_id,a.referred_by_profile_id,a.original_recruiter_id)) AND (a.assigned_recruiter_id=NEW.id OR public.is_descendant(NEW.id,a.assigned_recruiter_id) OR a.referred_by_profile_id=NEW.id OR public.is_descendant(NEW.id,a.referred_by_profile_id));
 WITH RECURSIVE tree AS (
 SELECT p.id,p.organization_path FROM public.profiles p WHERE p.id=NEW.id
 UNION ALL SELECT p.id,t.organization_path || p.id::text || '/' FROM public.profiles p JOIN tree t ON p.parent_user_id=t.id
 ) UPDATE public.profiles p SET organization_path=t.organization_path FROM tree t WHERE p.id=t.id AND p.organization_path IS DISTINCT FROM t.organization_path;
 RETURN NEW;
END $$;
CREATE TRIGGER profiles_refresh_uplines AFTER UPDATE OF parent_user_id,manager_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.refresh_hierarchy_uplines();
DO $$
BEGIN
 BEGIN
  PERFORM public.change_reporting_upline('6ad3b55a-d097-4e1c-9da8-e895f455a305','bc50bdb1-adc2-4bc9-bd74-6ac5fd774a51','applicant','dc792f65-8467-4180-81d5-296ba58ce4ad');
  RAISE EXCEPTION 'TEST FAILED: an agent was allowed to change hierarchy';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Only leaders can change uplines' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.change_reporting_upline('dc792f65-8467-4180-81d5-296ba58ce4ad','e85b0274-0fcc-49ed-a62a-b1bb6ed47c18','profile','dc792f65-8467-4180-81d5-296ba58ce4ad');
  RAISE EXCEPTION 'TEST FAILED: leader was allowed to move their ancestor';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'You can only move people within your organization' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.change_reporting_upline('e85b0274-0fcc-49ed-a62a-b1bb6ed47c18','dc792f65-8467-4180-81d5-296ba58ce4ad','profile','dc792f65-8467-4180-81d5-296ba58ce4ad');
  RAISE EXCEPTION 'TEST FAILED: hierarchy loop allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'That move would create a hierarchy loop' THEN RAISE; END IF; END;
END $$;