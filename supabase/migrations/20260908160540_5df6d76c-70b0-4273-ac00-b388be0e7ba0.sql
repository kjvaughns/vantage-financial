CREATE OR REPLACE FUNCTION public.search_recruiters(_q text)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, recruiting_slug text, team_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT coalesce(trim(_q), '') AS s)
  SELECT p.id, p.full_name, p.avatar_url, p.recruiting_slug, t.name AS team_name
  FROM public.profiles p
  LEFT JOIN public.teams t ON t.id = p.team_id
  CROSS JOIN q
  WHERE p.is_active = true AND p.can_receive_applicants = true AND p.recruiting_slug IS NOT NULL
    AND (q.s = ''
      OR p.full_name ILIKE '%' || q.s || '%'
      OR p.first_name ILIKE '%' || q.s || '%'
      OR p.last_name ILIKE '%' || q.s || '%'
      OR coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'') ILIKE '%' || q.s || '%'
      OR regexp_replace(coalesce(p.full_name,''), '\s+', ' ', 'g') ILIKE '%' || regexp_replace(q.s, '\s+', ' ', 'g') || '%')
  ORDER BY
    CASE WHEN q.s <> '' AND p.full_name ILIKE q.s || '%' THEN 0
         WHEN q.s <> '' AND (p.first_name ILIKE q.s || '%' OR p.last_name ILIKE q.s || '%') THEN 1
         ELSE 2 END,
    p.full_name
  LIMIT 50;
$function$;