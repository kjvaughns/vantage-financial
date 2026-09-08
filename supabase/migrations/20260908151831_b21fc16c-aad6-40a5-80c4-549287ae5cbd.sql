ALTER FUNCTION public.normalize_phone(text) SET search_path TO 'public';

REVOKE ALL ON FUNCTION public.find_applicant_duplicate(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_applicant_duplicate(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.possible_duplicate_applicants() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.find_applicant_duplicate(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lookup_applicant_duplicate(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.possible_duplicate_applicants() TO authenticated, service_role;