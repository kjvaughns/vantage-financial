CREATE OR REPLACE FUNCTION public.get_applicant_notify_context(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.applicants;
  rec public.profiles;
begin
  if _token is null or length(_token) < 10 then
    return jsonb_build_object('found', false);
  end if;

  select * into a from public.applicants where confirmation_token = _token limit 1;
  if a.id is null then
    return jsonb_build_object('found', false);
  end if;

  select * into rec from public.profiles
   where id = coalesce(a.assigned_recruiter_id, a.original_recruiter_id, a.referred_by_profile_id)
   limit 1;

  return jsonb_build_object(
    'found', true,
    'applicant_id', a.id,
    'first_name', a.first_name,
    'last_name', a.last_name,
    'email', a.email,
    'phone', a.phone,
    'state', a.state,
    'licensed', a.licensed,
    'has_downlines', coalesce(a.has_downlines, false),
    'instagram_handle', a.instagram_handle,
    'why_text', a.why_text,
    'requested_overview_at', a.requested_overview_at,
    'wants_one_on_one', coalesce(a.wants_one_on_one, false),
    'referred_by_name', coalesce(a.referred_by_name_snapshot, a.referred_by_name),
    'recruiter_id', rec.id,
    'recruiter_name', coalesce(rec.full_name, trim(coalesce(rec.first_name,'') || ' ' || coalesce(rec.last_name,''))),
    'recruiter_email', rec.email
  );
end;
$function$;