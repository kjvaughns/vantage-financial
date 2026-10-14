CREATE OR REPLACE FUNCTION public.reconcile_auto_onboarding(_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT s.step_key, min(e.completed_at) AS done_at
      FROM public.onboarding_steps s
      JOIN public.enrollments e ON e.course_id = s.auto_course_id AND e.user_id = _profile_id AND e.completed_at IS NOT NULL
     WHERE s.is_published AND s.completion_mode = 'auto'
     GROUP BY s.step_key
  LOOP
    UPDATE public.applicants
       SET onboarding_steps = jsonb_set(coalesce(onboarding_steps,'{}'::jsonb), ARRAY[r.step_key],
             jsonb_build_object('completed', true, 'completed_at', to_jsonb(r.done_at))),
           updated_at = now()
     WHERE portal_profile_id = _profile_id
       AND coalesce(onboarding_steps -> r.step_key ->> 'completed','false') <> 'true';
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_auto_onboarding(uuid) FROM PUBLIC, anon, authenticated;

-- Self-heal whenever an agent loads/updates their checklist
CREATE OR REPLACE FUNCTION public.update_onboarding(_step text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.applicants%ROWTYPE;
  v_steps jsonb;
  v_valid text[] := public.onboarding_step_keys(false);
  v_required text[] := public.onboarding_step_keys(true);
  v_done int;
  v_total int := coalesce(array_length(v_required, 1), 0);
  v_complete boolean;
  v_just_completed boolean := false;
  v_k text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.reconcile_auto_onboarding(v_uid);

  SELECT * INTO v_app FROM public.applicants WHERE portal_profile_id = v_uid ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;

  v_steps := coalesce(v_app.onboarding_steps, '{}'::jsonb);
  IF v_steps ? 'agentspace_contracting' AND NOT (v_steps ? 'agent_cloud_onboarding') THEN
    v_steps := (v_steps - 'agentspace_contracting') || jsonb_build_object('agent_cloud_onboarding', v_steps -> 'agentspace_contracting');
  END IF;
  FOREACH v_k IN ARRAY v_valid LOOP
    IF NOT (v_steps ? v_k) THEN
      v_steps := jsonb_set(v_steps, ARRAY[v_k], jsonb_build_object('completed', false, 'completed_at', null));
    END IF;
  END LOOP;
  IF _step IS NOT NULL AND _step <> '' THEN
    IF NOT (_step = ANY(v_valid)) THEN RAISE EXCEPTION 'Invalid onboarding step'; END IF;
    IF coalesce((v_steps -> _step ->> 'completed')::boolean, false) = false THEN
      v_steps := jsonb_set(v_steps, ARRAY[_step], jsonb_build_object('completed', true, 'completed_at', to_jsonb(now())));
    END IF;
  END IF;
  SELECT count(*) INTO v_done FROM unnest(v_required) k WHERE coalesce((v_steps -> k ->> 'completed')::boolean, false);
  v_complete := v_total > 0 AND v_done = v_total;
  IF v_complete AND v_app.onboarding_completed_at IS NULL THEN
    v_just_completed := true;
    UPDATE public.applicants SET onboarding_steps = v_steps, onboarding_completed_at = now(), updated_at = now() WHERE id = v_app.id;
  ELSE
    UPDATE public.applicants SET onboarding_steps = v_steps, updated_at = now() WHERE id = v_app.id;
  END IF;
  RETURN jsonb_build_object('found', true, 'applicant_id', v_app.id, 'email', v_app.email,
    'first_name', v_app.first_name, 'last_name', v_app.last_name, 'steps', v_steps,
    'done', v_done, 'total', v_total, 'complete', v_complete, 'just_completed', v_just_completed);
END;
$function$;

-- Backfill everyone who already finished the course
DO $$ DECLARE u uuid; BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.enrollments WHERE completed_at IS NOT NULL LOOP
    PERFORM public.reconcile_auto_onboarding(u);
  END LOOP;
END $$;