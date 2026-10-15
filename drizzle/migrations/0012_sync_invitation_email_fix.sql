CREATE OR REPLACE FUNCTION public.ensure_onboarding_invitation(_applicant_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  a public.applicants; v_email text; v_token text; v_id uuid; v_recruiter uuid;
BEGIN
  SELECT * INTO a FROM public.applicants WHERE id = _applicant_id;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  v_email := lower(trim(coalesce(a.email, '')));
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_email'); END IF;
  IF a.portal_profile_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'has_account');
  END IF;

  UPDATE public.invitations SET status = 'cancelled', updated_at = now()
  WHERE applicant_id = a.id AND status = 'pending' AND lower(email) <> v_email;

  SELECT id, token INTO v_id, v_token FROM public.invitations
  WHERE status = 'pending' AND (applicant_id = a.id OR lower(email) = v_email) AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_token IS NOT NULL THEN
    UPDATE public.invitations SET applicant_id = COALESCE(applicant_id, a.id) WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token, 'reused', true);
  END IF;

  v_recruiter := COALESCE(a.assigned_recruiter_id, a.original_recruiter_id);
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.invitations (email, first_name, last_name, phone, role, parent_user_id,
    state, licensed, npn, invited_by, applicant_id, token)
  VALUES (v_email, nullif(trim(coalesce(a.first_name, '')), ''), nullif(trim(coalesce(a.last_name, '')), ''),
    nullif(trim(coalesce(a.phone, '')), ''), 'agent', v_recruiter,
    nullif(trim(coalesce(a.resident_state, a.state, '')), ''), true,
    nullif(trim(coalesce(a.npn, '')), ''), v_recruiter, a.id, v_token)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token, 'reused', false);
END; $function$;