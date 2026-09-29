ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS has_downlines boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.submit_application(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first text := trim(coalesce(payload->>'first_name', ''));
  v_last  text := trim(coalesce(payload->>'last_name', ''));
  v_email text := lower(trim(coalesce(payload->>'email', '')));
  v_phone text := trim(coalesce(payload->>'phone', ''));
  v_state text := nullif(upper(trim(coalesce(payload->>'state', ''))), '');
  v_licensed boolean := coalesce((payload->>'licensed')::boolean, false);
  v_downlines boolean := coalesce((payload->>'has_downlines')::boolean, false);
  v_referred_by uuid := nullif(payload->>'referred_by_profile_id', '')::uuid;
  v_original_ref uuid := nullif(payload->>'original_referral_profile_id', '')::uuid;
  v_referral_source text := nullif(trim(coalesce(payload->>'referral_source', '')), '');
  v_referral_slug text := nullif(lower(trim(coalesce(payload->>'referral_slug', ''))), '');
  v_landing_url text := nullif(trim(coalesce(payload->>'referral_landing_url', '')), '');
  v_invalid_slug text := nullif(trim(coalesce(payload->>'invalid_referral_slug', '')), '');
  v_instagram text := nullif(trim(coalesce(payload->>'instagram_handle', '')), '');
  v_typed_name text := nullif(trim(coalesce(payload->>'referred_by_name', '')), '');
  v_self boolean := (v_referral_source = 'self');
  v_stage_id uuid; v_source_id uuid;
  v_rec_name text; v_rec_team uuid; v_rec_manager uuid;
  v_is_manager boolean := false;
  v_orig_name text;
  v_assigned_recruiter uuid; v_assigned_manager uuid; v_team uuid; v_original_recruiter uuid;
  v_id uuid;
  v_dupe uuid;
  v_existing public.applicants%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_type text := CASE WHEN v_licensed THEN 'licensed' ELSE 'unlicensed' END;
BEGIN
  IF v_first = '' OR v_last = '' OR v_email = '' OR v_phone = '' THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  -- Downlines only make sense for an already-licensed producer.
  IF NOT v_licensed THEN
    v_downlines := false;
  END IF;

  IF v_self THEN
    v_referred_by := NULL;
    v_original_ref := NULL;
    v_rec_name := 'Found us directly';
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'direct';
  ELSE
    IF v_referred_by IS NULL AND v_typed_name IS NULL THEN
      RAISE EXCEPTION 'A referring recruiter must be selected';
    END IF;
    IF v_referred_by IS NOT NULL THEN
      SELECT p.full_name, p.team_id, p.manager_id INTO v_rec_name, v_rec_team, v_rec_manager
        FROM public.profiles p
        WHERE p.id = v_referred_by AND p.is_active = true AND p.can_receive_applicants = true;
      IF v_rec_name IS NULL THEN
        RAISE EXCEPTION 'Selected recruiter is not a valid active agent';
      END IF;
      SELECT EXISTS (SELECT 1 FROM public.user_roles
        WHERE user_id = v_referred_by AND role IN ('manager', 'admin', 'super_admin')) INTO v_is_manager;
      IF v_is_manager THEN
        v_assigned_recruiter := v_referred_by; v_assigned_manager := v_referred_by; v_team := v_rec_team;
      ELSE
        v_assigned_recruiter := v_referred_by; v_assigned_manager := v_rec_manager; v_team := v_rec_team;
      END IF;
    ELSE
      v_rec_name := v_typed_name;
    END IF;
    IF v_original_ref IS NOT NULL THEN
      SELECT p.full_name INTO v_orig_name FROM public.profiles p WHERE p.id = v_original_ref;
    END IF;
    v_original_recruiter := coalesce(v_original_ref, v_referred_by);
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'referral';
  END IF;

  SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE slug = 'new-applicant';

  v_dupe := public.find_applicant_duplicate(v_email, v_phone, v_last);
  IF v_dupe IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.applicants WHERE id = v_dupe;

    UPDATE public.applicants SET
      first_name = coalesce(nullif(v_first, ''), first_name),
      last_name = coalesce(nullif(v_last, ''), last_name),
      email = coalesce(nullif(v_email, ''), email),
      phone = coalesce(nullif(v_phone, ''), phone),
      state = coalesce(v_state, state),
      licensed = v_licensed,
      licensing_status = v_type,
      has_downlines = v_downlines OR has_downlines,
      why_text = coalesce(nullif(payload->>'why_text', ''), why_text),
      instagram_handle = coalesce(v_instagram, instagram_handle),
      consent_contact = coalesce((payload->>'consent_contact')::boolean, consent_contact),
      referred_by_profile_id = coalesce(referred_by_profile_id, v_referred_by),
      referred_by_name_snapshot = coalesce(referred_by_name_snapshot, v_rec_name),
      original_referral_profile_id = coalesce(original_referral_profile_id, v_original_ref),
      original_referral_name_snapshot = coalesce(original_referral_name_snapshot, v_orig_name),
      original_recruiter_id = coalesce(original_recruiter_id, v_original_recruiter),
      assigned_recruiter_id = coalesce(assigned_recruiter_id, v_assigned_recruiter),
      assigned_manager_id = coalesce(assigned_manager_id, v_assigned_manager),
      team_id = coalesce(team_id, v_team),
      source_id = coalesce(source_id, v_source_id),
      ref_slug = coalesce(ref_slug, v_referral_slug),
      confirmation_token = v_token,
      success_page_type = v_type,
      updated_at = now()
    WHERE id = v_dupe;

    INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
    VALUES (v_dupe, 'application_resubmitted',
            'Applicant re-submitted the application — existing record updated instead of creating a duplicate',
            jsonb_build_object(
              'licensed', v_licensed,
              'has_downlines', v_downlines,
              'referral_source', coalesce(v_referral_source, 'manual'),
              'submitted_email', v_email,
              'submitted_phone', v_phone));

    RETURN jsonb_build_object(
      'id', v_dupe,
      'token', v_token,
      'success_page_type', v_type,
      'has_downlines', v_downlines,
      'recruiter_id', coalesce(v_existing.assigned_recruiter_id, v_assigned_recruiter),
      'duplicate', true);
  END IF;

  INSERT INTO public.applicants (
    first_name, last_name, email, phone,
    state, licensed, licensing_status, has_downlines, why_text, consent_contact,
    instagram_handle, source_id, ref_slug,
    referred_by_profile_id, referred_by_name_snapshot,
    original_referral_profile_id, original_referral_name_snapshot,
    referral_source, referral_landing_url, invalid_referral_slug,
    original_recruiter_id, assigned_recruiter_id, assigned_manager_id, team_id,
    current_stage_id, stage_entered_at, confirmation_token, success_page_type
  ) VALUES (
    v_first, v_last, v_email, v_phone,
    v_state, v_licensed, v_type, v_downlines, nullif(payload->>'why_text', ''),
    coalesce((payload->>'consent_contact')::boolean, true),
    v_instagram, v_source_id, v_referral_slug,
    v_referred_by, v_rec_name,
    v_original_ref, v_orig_name,
    coalesce(v_referral_source, 'manual'), v_landing_url, v_invalid_slug,
    v_original_recruiter, v_assigned_recruiter, v_assigned_manager, v_team,
    v_stage_id, now(), v_token, v_type
  ) RETURNING id INTO v_id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (v_id, 'application_submitted',
          CASE WHEN v_self
            THEN 'Application submitted from public site — found us directly (unassigned lead)'
            ELSE 'Application submitted from public site' END,
          jsonb_build_object(
            'referred_by_profile_id', v_referred_by,
            'original_referral_profile_id', v_original_ref,
            'referral_source', coalesce(v_referral_source, 'manual'),
            'referral_slug', v_referral_slug,
            'invalid_referral_slug', v_invalid_slug,
            'has_downlines', v_downlines,
            'licensed', v_licensed));

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'success_page_type', v_type, 'has_downlines', v_downlines, 'recruiter_id', v_assigned_recruiter, 'duplicate', false);
END;
$function$;