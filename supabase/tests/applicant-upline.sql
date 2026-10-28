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
  public.highest_leader_in_chain(chain) = '00000000-0000-0000-0000-000000000004'::uuid AS three_levels_chooses_highest,
  public.highest_leader_in_chain(jsonb_set(chain, '{3,active}', 'false')) = '00000000-0000-0000-0000-000000000003'::uuid AS inactive_leader_skipped,
  public.highest_leader_in_chain(jsonb_build_array(chain->0)) IS NULL AS agents_not_uplines,
  public.highest_leader_in_chain('[]'::jsonb) IS NULL AS empty_hierarchy_unassigned
FROM fixtures;