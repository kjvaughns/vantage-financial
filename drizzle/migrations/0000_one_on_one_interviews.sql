UPDATE public.system_settings SET value = 'https://calendly.com/kjvaughns1/opportunity-meeting'
 WHERE key IN ('unlicensed_overview_calendly_url','calendly_url','owner_one_on_one_calendly_url');
UPDATE public.email_campaigns SET enabled = false WHERE slug = 'overview-invite-weekly';

DROP POLICY IF EXISTS onboarding_sections_read ON public.onboarding_sections;
CREATE POLICY onboarding_sections_read ON public.onboarding_sections FOR SELECT TO authenticated
  USING (is_published OR public.academy_can_manage(auth.uid()));
DROP POLICY IF EXISTS onboarding_steps_read ON public.onboarding_steps;
CREATE POLICY onboarding_steps_read ON public.onboarding_steps FOR SELECT TO authenticated
  USING (is_published OR public.academy_can_manage(auth.uid()));