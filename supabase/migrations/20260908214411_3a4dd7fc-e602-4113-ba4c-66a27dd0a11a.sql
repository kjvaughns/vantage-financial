REVOKE EXECUTE ON FUNCTION public.onboarding_step_keys(boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.default_onboarding_steps() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_onboarding_step(uuid, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_auto_onboarding_steps() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.onboarding_step_keys(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.default_onboarding_steps() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_onboarding_step(uuid, text, boolean) TO authenticated, service_role;
