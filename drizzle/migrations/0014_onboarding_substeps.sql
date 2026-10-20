ALTER TABLE public.onboarding_steps ADD COLUMN IF NOT EXISTS substeps jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS onboarding_substeps jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.my_onboarding_substeps()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT onboarding_substeps FROM public.applicants
    WHERE portal_profile_id = auth.uid() ORDER BY created_at DESC LIMIT 1), '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.toggle_onboarding_substep(_step text, _sub text, _done boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_map jsonb; v_list jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_steps s WHERE s.step_key = _step
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.substeps) e WHERE e->>'id' = _sub)) THEN
    RAISE EXCEPTION 'Unknown substep';
  END IF;
  SELECT id, coalesce(onboarding_substeps,'{}'::jsonb) INTO v_id, v_map FROM public.applicants
    WHERE portal_profile_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'No onboarding record'; END IF;
  v_list := coalesce(v_map->_step, '[]'::jsonb);
  v_list := coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements_text(v_list) x WHERE x <> _sub), '[]'::jsonb);
  IF _done THEN v_list := v_list || to_jsonb(_sub); END IF;
  v_map := jsonb_set(v_map, ARRAY[_step], v_list);
  UPDATE public.applicants SET onboarding_substeps = v_map, updated_at = now() WHERE id = v_id;
  RETURN v_map;
END $$;

GRANT EXECUTE ON FUNCTION public.my_onboarding_substeps() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_onboarding_substep(text, text, boolean) TO authenticated;