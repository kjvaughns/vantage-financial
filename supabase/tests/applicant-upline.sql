-- Run with the read-only database query tool. Every result must be true.
WITH fixtures AS (
  SELECT '[
    {"id":"00000000-0000-0000-0000-000000000001","active":true,"roles":["agent"]},
    {"id":"00000000-0000-0000-0000-000000000002","active":true,"roles":["leader"]},
    {"id":"00000000-0000-0000-0000-000000000003","active":true,"roles":["manager"]},
    {"id":"00000000-0000-0000-0000-000000000004","active":true,"roles":["super_admin"]}
  ]'::jsonb AS chain
)
SELECT
  public.highest_leader_in_chain(chain) = '00000000-0000-0000-0000-000000000002'::uuid AS nearest_leader_not_top_admin,
  public.highest_leader_in_chain(jsonb_set(chain, '{1,active}', 'false')) = '00000000-0000-0000-0000-000000000003'::uuid AS inactive_nearest_leader_skipped,
  public.highest_leader_in_chain(jsonb_build_array(chain->1,chain->3)) = '00000000-0000-0000-0000-000000000002'::uuid AS leader_recruiter_owns_contracting,
  public.resolve_applicant_upline('6ad3b55a-d097-4e1c-9da8-e895f455a305'::uuid) = 'dc792f65-8467-4180-81d5-296ba58ce4ad'::uuid AS benjamin_jaden_pranav_not_kj,
  public.highest_leader_in_chain(jsonb_build_array(chain->0)) IS NULL AS agents_not_uplines,
  public.highest_leader_in_chain('[]'::jsonb) IS NULL AS empty_hierarchy_unassigned
FROM fixtures;