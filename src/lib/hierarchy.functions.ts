import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManageHierarchy, canMoveWithinHierarchy } from "./hierarchy-permissions";

export const getHierarchyOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRows } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!canManageHierarchy(roles)) return { canManage: false, leaders: [], actorId: context.userId };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: descendants } = await supabaseAdmin.rpc("descendant_ids", { _root: context.userId });
    const scope = [context.userId, ...(descendants ?? []).map((r) => r.id)];
    const { data: leaderRoles } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["leader", "manager", "admin", "super_admin"]);
    const elevated = roles.includes("admin") || roles.includes("super_admin");
    const ids = [...new Set((leaderRoles ?? []).map((r) => r.user_id).filter((id) => elevated || scope.includes(id)))];
    if (!ids.length) return { canManage: true, leaders: [], actorId: context.userId };
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,full_name,first_name,last_name").in("id", ids).eq("is_active", true).order("first_name");
    return { canManage: true, actorId: context.userId, leaders: (profiles ?? []).map((p) => ({ id: p.id, name: p.full_name || [p.first_name,p.last_name].filter(Boolean).join(" ") })) };
  });

export const changeUpline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), kind: z.enum(["applicant", "profile"]), upline_id: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: roleRows } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!canManageHierarchy(roles)) throw new Error("Only leaders can change uplines.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.kind === "profile") {
      const { data: descendants } = await supabaseAdmin.rpc("descendant_ids", { _root: context.userId });
      if (!canMoveWithinHierarchy(roles, context.userId, data.id, data.upline_id, (descendants ?? []).map((r) => r.id))) throw new Error("You can only move people within your organization.");
    }
    // The service-only database action independently validates caller roles,
    // both sides of the move, active leader status and hierarchy loops.
    const { error } = await supabaseAdmin.rpc("change_reporting_upline", { _actor: context.userId, _target: data.id, _kind: data.kind, _upline: data.upline_id as string });
    if (error) throw new Error(error.message);
    return { ok: true };
  });