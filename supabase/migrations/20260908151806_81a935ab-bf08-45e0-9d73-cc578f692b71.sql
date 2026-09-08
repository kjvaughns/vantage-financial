CREATE OR REPLACE FUNCTION public.normalize_phone(_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(right(regexp_replace(coalesce(_txt, ''), '\D', '', 'g'), 10), '');
$$;

-- Finds an existing, non-archived applicant that looks like the same person.
-- Match order: exact email, then normalized phone + last name.
CREATE OR REPLACE FUNCTION public.find_applicant_duplicate(_email text, _phone text, _last_name text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM (
    SELECT a.id, 0 AS rank, a.created_at
      FROM public.applicants a
     WHERE a.archived_at IS NULL
       AND lower(a.email) = lower(trim(coalesce(_email, '')))
       AND coalesce(trim(_email), '') <> ''
    UNION ALL
    SELECT a.id, 1 AS rank, a.created_at
      FROM public.applicants a
     WHERE a.archived_at IS NULL
       AND public.normalize_phone(a.phone) IS NOT NULL
       AND public.normalize_phone(a.phone) = public.normalize_phone(_phone)
       AND lower(trim(a.last_name)) = lower(trim(coalesce(_last_name, '')))
       AND coalesce(trim(_last_name), '') <> ''
  ) m
  ORDER BY rank, created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_applicant_duplicate(text, text, text) TO service_role;

-- Staff-facing duplicate preview for the manual "Add applicant" form.
CREATE OR REPLACE FUNCTION public.lookup_applicant_duplicate(_email text, _phone text, _last_name text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid; r record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  v_id := public.find_applicant_duplicate(_email, _phone, _last_name);
  IF v_id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT a.id, a.first_name, a.last_name, a.email, a.phone, a.created_at,
         s.name AS stage_name, p.full_name AS recruiter_name
    INTO r
    FROM public.applicants a
    LEFT JOIN public.pipeline_stages s ON s.id = a.current_stage_id
    LEFT JOIN public.profiles p ON p.id = a.assigned_recruiter_id
   WHERE a.id = v_id;
  RETURN jsonb_build_object(
    'found', true,
    'id', r.id,
    'name', trim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')),
    'email', r.email,
    'phone', r.phone,
    'stage', r.stage_name,
    'recruiter_name', r.recruiter_name,
    'created_at', r.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_applicant_duplicate(text, text, text) TO authenticated;

-- Possible duplicate groups (email or normalized phone shared by 2+ records).
CREATE OR REPLACE FUNCTION public.possible_duplicate_applicants()
RETURNS TABLE(
  group_key text,
  match_kind text,
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  stage_name text,
  recruiter_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH live AS (
    SELECT a.*, public.normalize_phone(a.phone) AS np FROM public.applicants a WHERE a.archived_at IS NULL
  ),
  email_groups AS (
    SELECT lower(email) AS k FROM live GROUP BY 1 HAVING count(*) > 1
  ),
  phone_groups AS (
    SELECT np AS k FROM live WHERE np IS NOT NULL GROUP BY 1 HAVING count(distinct lower(email)) > 1
  ),
  matched AS (
    SELECT lower(l.email) AS group_key, 'email'::text AS match_kind, l.* FROM live l
      JOIN email_groups g ON g.k = lower(l.email)
    UNION ALL
    SELECT l.np AS group_key, 'phone'::text AS match_kind, l.* FROM live l
      JOIN phone_groups g ON g.k = l.np
  )
  SELECT m.group_key, m.match_kind, m.id, m.first_name, m.last_name, m.email, m.phone,
         s.name, p.full_name, m.created_at
    FROM matched m
    LEFT JOIN public.pipeline_stages s ON s.id = m.current_stage_id
    LEFT JOIN public.profiles p ON p.id = m.assigned_recruiter_id
   WHERE public.is_staff(auth.uid())
   ORDER BY m.match_kind, m.group_key, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.possible_duplicate_applicants() TO authenticated;

-- Duplicate-aware public application submit.
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

  -- Same person applying again: refresh their record instead of duplicating it.
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
      why_text = coalesce(nullif(payload->>'why_text', ''), why_text),
      instagram_handle = coalesce(v_instagram, instagram_handle),
      consent_contact = coalesce((payload->>'consent_contact')::boolean, consent_contact),
      -- attribution is never overwritten once set
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
              'referral_source', coalesce(v_referral_source, 'manual'),
              'submitted_email', v_email,
              'submitted_phone', v_phone));

    RETURN jsonb_build_object(
      'id', v_dupe,
      'token', v_token,
      'success_page_type', v_type,
      'recruiter_id', coalesce(v_existing.assigned_recruiter_id, v_assigned_recruiter),
      'duplicate', true);
  END IF;

  INSERT INTO public.applicants (
    first_name, last_name, email, phone,
    state, licensed, licensing_status, why_text, consent_contact,
    instagram_handle, source_id, ref_slug,
    referred_by_profile_id, referred_by_name_snapshot,
    original_referral_profile_id, original_referral_name_snapshot,
    referral_source, referral_landing_url, invalid_referral_slug,
    original_recruiter_id, assigned_recruiter_id, assigned_manager_id, team_id,
    current_stage_id, stage_entered_at, confirmation_token, success_page_type
  ) VALUES (
    v_first, v_last, v_email, v_phone,
    v_state, v_licensed, v_type, nullif(payload->>'why_text', ''),
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
            'licensed', v_licensed));

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'success_page_type', v_type, 'recruiter_id', v_assigned_recruiter, 'duplicate', false);
END;
$function$;