-- ============ Onboarding content ============
CREATE TABLE public.onboarding_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES public.onboarding_sections(id) ON DELETE SET NULL,
  step_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  instructions text,
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT true,
  action_type text NOT NULL DEFAULT 'none',
  action_url text,
  internal_path text,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  resource_id uuid REFERENCES public.library_resources(id) ON DELETE SET NULL,
  recording_id uuid REFERENCES public.recordings(id) ON DELETE SET NULL,
  button_label text,
  completion_mode text NOT NULL DEFAULT 'self',
  auto_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  show_schedule boolean NOT NULL DEFAULT false,
  show_upline boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_steps_action_type_check CHECK (action_type IN ('none','external','internal','course','resource','presentation')),
  CONSTRAINT onboarding_steps_completion_mode_check CHECK (completion_mode IN ('self','admin','auto')),
  CONSTRAINT onboarding_steps_key_format CHECK (step_key ~ '^[a-z0-9_]+$')
);

CREATE INDEX onboarding_steps_section_idx ON public.onboarding_steps (section_id, position);

-- ============ Training schedule ============
CREATE TABLE public.training_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  when_text text NOT NULL,
  note text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Shared links ============
CREATE TABLE public.app_links (
  key text PRIMARY KEY,
  label text NOT NULL,
  url text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Academy starter templates ============
CREATE TABLE public.academy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_templates_kind_check CHECK (kind IN ('course','library'))
);

-- ============ Grants ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_sections TO authenticated;
GRANT ALL ON public.onboarding_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_steps TO authenticated;
GRANT ALL ON public.onboarding_steps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_schedule_items TO authenticated;
GRANT ALL ON public.training_schedule_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_links TO authenticated;
GRANT ALL ON public.app_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_templates TO authenticated;
GRANT ALL ON public.academy_templates TO service_role;

ALTER TABLE public.onboarding_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_templates ENABLE ROW LEVEL SECURITY;

-- ============ Policies ============
CREATE POLICY "onboarding_sections_read" ON public.onboarding_sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "onboarding_sections_manage" ON public.onboarding_sections
  FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid()))
  WITH CHECK (public.academy_can_manage(auth.uid()));

CREATE POLICY "onboarding_steps_read" ON public.onboarding_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "onboarding_steps_manage" ON public.onboarding_steps
  FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid()))
  WITH CHECK (public.academy_can_manage(auth.uid()));

CREATE POLICY "training_schedule_read" ON public.training_schedule_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_schedule_manage" ON public.training_schedule_items
  FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid()))
  WITH CHECK (public.academy_can_manage(auth.uid()));

CREATE POLICY "app_links_read" ON public.app_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_links_manage" ON public.app_links
  FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid()))
  WITH CHECK (public.academy_can_manage(auth.uid()));

CREATE POLICY "academy_templates_read" ON public.academy_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy_templates_manage" ON public.academy_templates
  FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid()))
  WITH CHECK (public.academy_can_manage(auth.uid()));

-- ============ updated_at triggers ============
CREATE TRIGGER onboarding_sections_touch BEFORE UPDATE ON public.onboarding_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER onboarding_steps_touch BEFORE UPDATE ON public.onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER training_schedule_touch BEFORE UPDATE ON public.training_schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER academy_templates_touch BEFORE UPDATE ON public.academy_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Seed: today's onboarding ============
INSERT INTO public.onboarding_sections (id, title, description, position)
VALUES ('11111111-1111-4111-8111-111111111111', 'Getting started', 'Complete these steps in order to finish onboarding.', 0);

INSERT INTO public.onboarding_steps
  (section_id, step_key, title, description, position, is_required, action_type, action_url, internal_path, button_label, completion_mode, show_schedule, show_upline)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'agent_cloud_onboarding', 'Agent Cloud onboarding',
   'Accept your Agent Cloud invite and finish contracting so you can get paid.', 0, true,
   'external', 'https://useagentcloud.com/invite/dcee6766-4b8f-44c0-9f4c-025ccdcbce2e', NULL, 'Open Agent Cloud', 'self', false, true),
  ('11111111-1111-4111-8111-111111111111', 'discord_role_update', 'Update Discord role',
   'Join the Discord and ask for your licensed agent role so you get the right channels.', 1, true,
   'external', 'https://discord.gg/sFgEEPRSmw', NULL, 'Join the Discord', 'self', false, true),
  ('11111111-1111-4111-8111-111111111111', 'read_agent_playbook', 'Read the Agent Playbook',
   'The playbook covers how we sell, how we get paid, and what good looks like here.', 2, true,
   'internal', NULL, '/portal/academy', 'Open the Academy', 'self', false, false),
  ('11111111-1111-4111-8111-111111111111', 'agent_expectations_schedule', 'Agent expectations & schedule',
   'Know the weekly schedule and what is expected of every Vantage agent.', 3, true,
   'none', NULL, NULL, NULL, 'self', true, false),
  ('11111111-1111-4111-8111-111111111111', 'complete_vantage_closer_course', 'Complete the Vantage Closer Course',
   'Finish every lesson and pass the quizzes. This ticks itself off when the course is done.', 4, true,
   'internal', NULL, '/portal/academy', 'Open the course', 'auto', false, false);

UPDATE public.onboarding_steps s
   SET auto_course_id = c.id, course_id = c.id
  FROM public.courses c
 WHERE c.slug = 'vantage-closer' AND s.step_key = 'complete_vantage_closer_course';

-- ============ Seed: schedule ============
INSERT INTO public.training_schedule_items (label, when_text, note, position) VALUES
  ('Mandatory Team Meeting', 'Monday 9:00 AM', NULL, 0),
  ('New Agent Live Training', 'Daily 10:00 AM', 'Training Room Discord voice channel', 1),
  ('Company Overview', 'Monday 7:00 PM', NULL, 2),
  ('Agency Training', 'Wednesday 10:30 AM', NULL, 3),
  ('Film Review', 'Monday–Thursday 6:00 PM', 'Training Room — mandatory for anyone who hasn''t closed a deal that day', 4),
  ('Live Dials', '10:00 AM to 6:00 PM daily', NULL, 5);

-- ============ Seed: links ============
INSERT INTO public.app_links (key, label, url, description) VALUES
  ('discord_invite', 'Discord invite', 'https://discord.gg/sFgEEPRSmw', 'Used in emails, success pages and onboarding.'),
  ('licensing_course', 'Pre-licensing course', 'https://partners.xcelsolutions.com/afe', 'Xcel course applicants purchase.'),
  ('state_requirements', 'State licensing requirements', 'https://partners.xcelsolutions.com/insurance-license/requirements?partner=afe', 'State-by-state requirements page.'),
  ('nipr', 'Apply for your license (NIPR)', 'https://nipr.com', 'Where applicants formally apply.'),
  ('agent_cloud', 'Agent Cloud invite', 'https://useagentcloud.com/invite/dcee6766-4b8f-44c0-9f4c-025ccdcbce2e', 'Contracting invite for new licensed agents.'),
  ('instagram', 'Team Instagram', 'https://instagram.com/vantage.financial', 'Shown on the public site and email footers.');

-- ============ Progress engine now reads the table ============
CREATE OR REPLACE FUNCTION public.onboarding_step_keys(_required_only boolean DEFAULT false)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(step_key ORDER BY position, created_at), ARRAY[]::text[])
    FROM public.onboarding_steps
   WHERE is_published
     AND (NOT _required_only OR is_required)
$$;

CREATE OR REPLACE FUNCTION public.default_onboarding_steps()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_object_agg(step_key, jsonb_build_object('completed', false, 'completed_at', null)),
    '{}'::jsonb
  )
  FROM public.onboarding_steps
  WHERE is_published
$$;

CREATE OR REPLACE FUNCTION public.update_onboarding(_step text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT * INTO v_app FROM public.applicants
    WHERE portal_profile_id = v_uid
    ORDER BY created_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_steps := coalesce(v_app.onboarding_steps, '{}'::jsonb);

  IF v_steps ? 'agentspace_contracting' AND NOT (v_steps ? 'agent_cloud_onboarding') THEN
    v_steps := (v_steps - 'agentspace_contracting')
      || jsonb_build_object('agent_cloud_onboarding', v_steps -> 'agentspace_contracting');
  END IF;

  -- make sure every published step has an entry
  FOREACH v_k IN ARRAY v_valid LOOP
    IF NOT (v_steps ? v_k) THEN
      v_steps := jsonb_set(v_steps, ARRAY[v_k], jsonb_build_object('completed', false, 'completed_at', null));
    END IF;
  END LOOP;

  IF _step IS NOT NULL AND _step <> '' THEN
    IF NOT (_step = ANY(v_valid)) THEN RAISE EXCEPTION 'Invalid onboarding step'; END IF;
    IF coalesce((v_steps -> _step ->> 'completed')::boolean, false) = false THEN
      v_steps := jsonb_set(
        v_steps, ARRAY[_step],
        jsonb_build_object('completed', true, 'completed_at', to_jsonb(now()))
      );
    END IF;
  END IF;

  SELECT count(*) INTO v_done
    FROM unnest(v_required) k
    WHERE coalesce((v_steps -> k ->> 'completed')::boolean, false);
  v_complete := v_total > 0 AND v_done = v_total;

  IF v_complete AND v_app.onboarding_completed_at IS NULL THEN
    v_just_completed := true;
    UPDATE public.applicants
      SET onboarding_steps = v_steps, onboarding_completed_at = now(), updated_at = now()
      WHERE id = v_app.id;
  ELSE
    UPDATE public.applicants
      SET onboarding_steps = v_steps, updated_at = now()
      WHERE id = v_app.id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'applicant_id', v_app.id,
    'email', v_app.email,
    'first_name', v_app.first_name,
    'last_name', v_app.last_name,
    'steps', v_steps,
    'done', v_done,
    'total', v_total,
    'complete', v_complete,
    'just_completed', v_just_completed
  );
END;
$function$;

-- Admin marks an admin-confirmed step complete for an agent
CREATE OR REPLACE FUNCTION public.admin_set_onboarding_step(_applicant_id uuid, _step text, _completed boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_steps jsonb;
BEGIN
  IF NOT public.academy_can_manage(auth.uid()) AND NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF NOT (_step = ANY(public.onboarding_step_keys(false))) THEN
    RAISE EXCEPTION 'Invalid onboarding step';
  END IF;

  SELECT coalesce(onboarding_steps, '{}'::jsonb) INTO v_steps
    FROM public.applicants WHERE id = _applicant_id;
  IF v_steps IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  v_steps := jsonb_set(
    v_steps, ARRAY[_step],
    CASE WHEN _completed
      THEN jsonb_build_object('completed', true, 'completed_at', to_jsonb(now()))
      ELSE jsonb_build_object('completed', false, 'completed_at', null)
    END
  );

  UPDATE public.applicants SET onboarding_steps = v_steps, updated_at = now() WHERE id = _applicant_id;
  RETURN jsonb_build_object('ok', true, 'steps', v_steps);
END;
$function$;

-- ============ Auto-complete a step when its linked course is finished ============
CREATE OR REPLACE FUNCTION public.sync_auto_onboarding_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_step text;
BEGIN
  IF NEW.completed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL THEN RETURN NEW; END IF;

  FOR v_step IN
    SELECT step_key FROM public.onboarding_steps
     WHERE is_published AND completion_mode = 'auto' AND auto_course_id = NEW.course_id
  LOOP
    UPDATE public.applicants
       SET onboarding_steps = jsonb_set(
             coalesce(onboarding_steps, '{}'::jsonb), ARRAY[v_step],
             jsonb_build_object('completed', true, 'completed_at', to_jsonb(now()))
           ),
           updated_at = now()
     WHERE portal_profile_id = NEW.user_id
       AND coalesce(onboarding_steps -> v_step ->> 'completed', 'false') <> 'true';
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER enrollments_sync_onboarding
  AFTER INSERT OR UPDATE OF completed_at ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.sync_auto_onboarding_steps();
