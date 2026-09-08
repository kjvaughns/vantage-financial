create or replace function public.profile_display_names(_ids uuid[])
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), '') as name
  from public.profiles p
  where p.id = any(_ids)
$$;

revoke all on function public.profile_display_names(uuid[]) from public;
grant execute on function public.profile_display_names(uuid[]) to authenticated, service_role;