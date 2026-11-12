-- Run with the read-only database query tool. Every result must be true.
SELECT
  first_name = 'Placid' AND last_name = 'Ajoku' AND full_name = 'Placid Ajoku' AS placid_name_saved,
  recruiting_slug = 'placid-ajoku-dda5f6' AS referral_uses_updated_name
FROM public.profiles
WHERE id = 'dda5f6f7-24de-4d4c-993d-0d5466917c7d';