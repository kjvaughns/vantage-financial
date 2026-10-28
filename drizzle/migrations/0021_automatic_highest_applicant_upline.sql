CREATE OR REPLACE FUNCTION public.highest_leader_in_chain(_chain jsonb)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT (node->>'id')::uuid
  FROM jsonb_array_elements(_chain) WITH ORDINALITY AS chain(node, position)
  WHERE coalesce((node->>'active')::boolean, false)
    AND (node->'roles') ?| ARRAY['leader','manager','admin','super_admin']
  ORDER BY position DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.highest_leader_in_chain(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.highest_leader_in_chain(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_applicant_upline(_recruiter uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE ancestry AS (
    SELECT p.id, p.parent_user_id, p.manager_id, p.is_active, 0 AS depth, ARRAY[p.id] AS visited
    FROM public.profiles p WHERE p.id = _recruiter
    UNION ALL
    SELECT p.id, p.parent_user_id, p.manager_id, p.is_active, a.depth + 1, a.visited || p.id
    FROM ancestry a
    JOIN public.profiles p ON p.id = coalesce(a.parent_user_id, a.manager_id)
    WHERE NOT p.id = ANY(a.visited)
  )
  SELECT public.highest_leader_in_chain(coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'active', a.is_active,
    'roles', (SELECT coalesce(jsonb_agg(r.role::text), '[]'::jsonb) FROM public.user_roles r WHERE r.user_id = a.id)
  ) ORDER BY a.depth), '[]'::jsonb)) FROM ancestry a;
$$;
REVOKE ALL ON FUNCTION public.resolve_applicant_upline(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_applicant_upline(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.assign_applicant_upline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.assigned_manager_id := public.resolve_applicant_upline(coalesce(NEW.assigned_recruiter_id, NEW.referred_by_profile_id, NEW.original_recruiter_id));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_applicant_upline() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER applicants_assign_highest_upline
BEFORE INSERT OR UPDATE ON public.applicants
FOR EACH ROW EXECUTE FUNCTION public.assign_applicant_upline();
COMMENT ON COLUMN public.applicants.assigned_manager_id IS 'Automatically resolved highest active leader in recruiter ancestry; referral attribution remains separate.';