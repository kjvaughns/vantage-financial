DO $$
DECLARE chain jsonb := '[{"id":"00000000-0000-0000-0000-000000000001","active":true,"roles":["agent"]},{"id":"00000000-0000-0000-0000-000000000002","active":true,"roles":["leader"]},{"id":"00000000-0000-0000-0000-000000000003","active":true,"roles":["manager"]},{"id":"00000000-0000-0000-0000-000000000004","active":true,"roles":["super_admin"]}]';
BEGIN
 IF public.highest_leader_in_chain(chain) IS DISTINCT FROM '00000000-0000-0000-0000-000000000002'::uuid THEN RAISE EXCEPTION 'Nearest leader must win over top admin'; END IF;
 IF public.highest_leader_in_chain(jsonb_set(chain,'{1,active}','false')) IS DISTINCT FROM '00000000-0000-0000-0000-000000000003'::uuid THEN RAISE EXCEPTION 'Inactive nearest leader must be skipped'; END IF;
 IF public.highest_leader_in_chain(jsonb_build_array(chain->1,chain->3)) IS DISTINCT FROM '00000000-0000-0000-0000-000000000002'::uuid THEN RAISE EXCEPTION 'Leader recruiter must own contracting'; END IF;
 IF public.highest_leader_in_chain(jsonb_build_array(chain->0)) IS NOT NULL THEN RAISE EXCEPTION 'Agents cannot be uplines'; END IF;
 IF public.highest_leader_in_chain('[]'::jsonb) IS NOT NULL THEN RAISE EXCEPTION 'Empty hierarchy must remain unassigned'; END IF;
 IF public.resolve_applicant_upline('6ad3b55a-d097-4e1c-9da8-e895f455a305') IS DISTINCT FROM 'dc792f65-8467-4180-81d5-296ba58ce4ad'::uuid THEN RAISE EXCEPTION 'Benjamin recruited by Jaden must resolve to Pranav, not KJ'; END IF;
END $$;