CREATE OR REPLACE FUNCTION public.finalize_invitation_acceptance(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.invitations%ROWTYPE; v_profile uuid := (payload->>'profile_id')::uuid;
BEGIN
  SELECT * INTO r FROM public.invitations WHERE token = (payload->>'token');
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Invitation is no longer valid'; END IF;
  IF r.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = r.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;
  UPDATE public.profiles SET
    first_name = coalesce(r.first_name, first_name),
    last_name = coalesce(r.last_name, last_name),
    phone = coalesce(nullif(payload->>'phone',''), r.phone, phone),
    state = coalesce(nullif(payload->>'state',''), r.state),
    npn = coalesce(nullif(payload->>'npn',''), r.npn),
    instagram_handle = coalesce(nullif(payload->>'instagram_handle',''), r.instagram_handle),
    timezone = nullif(payload->>'timezone',''),
    licensed = coalesce((payload->>'licensed')::boolean, r.licensed),
    parent_user_id = r.parent_user_id, manager_id = r.manager_id, team_id = r.team_id,
    can_invite_agents = r.can_invite_agents, can_invite_leaders = r.can_invite_leaders,
    can_manage_resources = r.can_manage_resources,
    is_active = true, status = 'active', updated_at = now()
  WHERE id = v_profile;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_profile, r.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.invitations SET status = 'accepted', accepted_profile_id = v_profile,
    accepted_at = now(), updated_at = now() WHERE id = r.id;
  IF r.applicant_id IS NOT NULL THEN
    UPDATE public.applicants SET portal_profile_id = v_profile, updated_at = now()
      WHERE id = r.applicant_id;
    -- Carry the pending AgentLink contracting link onto the new agent's profile.
    UPDATE public.profiles p SET assigned_agentlink_link_id = a.assigned_agentlink_link_id
      FROM public.applicants a
      WHERE a.id = r.applicant_id AND p.id = v_profile
        AND a.assigned_agentlink_link_id IS NOT NULL;
  END IF;
  RETURN jsonb_build_object('ok', true, 'invitation_id', r.id, 'role', r.role::text);
END; $function$;