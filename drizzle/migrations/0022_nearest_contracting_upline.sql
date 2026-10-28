CREATE OR REPLACE FUNCTION public.highest_leader_in_chain(_chain jsonb)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (node->>'id')::uuid
  FROM jsonb_array_elements(_chain) WITH ORDINALITY AS chain(node, position)
  WHERE coalesce((node->>'active')::boolean, false)
    AND (node->'roles') ?| ARRAY['leader','manager','admin','super_admin']
  ORDER BY position ASC LIMIT 1;
$$;
COMMENT ON FUNCTION public.highest_leader_in_chain(jsonb) IS 'Legacy function name: selects the nearest active qualifying contracting leader from recruiter-first ancestry, never the highest organizational leader.';