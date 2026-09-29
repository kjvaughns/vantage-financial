import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit } from "@/lib/audit";

// Anon/publishable client for public (unauthenticated) invitation reads.
function serverClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const ROLE_RANK: Record<string, number> = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  leader: 2,
  agent: 1,
};

// Roles a given user may invite, derived from their role + permission flags.
function invitableRoles(
  primaryRole: string | null,
  perms: { agents: boolean; leaders: boolean },
): string[] {
  switch (primaryRole) {
    case "super_admin":
    case "admin":
      return ["manager", "leader", "agent"];
    case "manager":
      return ["leader", "agent"];
    case "leader": {
      const out: string[] = [];
      if (perms.leaders) out.push("leader");
      out.push("agent");
      return out;
    }
    case "agent":
      return ["agent"];
    default:
      return ["agent"];
  }
}

/** Roles the current user may invite + the users they may assign as parent. */
export const getInvitableContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("can_invite_agents, can_invite_leaders")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const primaryRole =
      ["super_admin", "admin", "manager", "leader", "agent"].find((r) => roles.includes(r)) ?? null;
    const allowedRoles = invitableRoles(primaryRole, {
      agents: !!prof?.can_invite_agents,
      leaders: !!prof?.can_invite_leaders,
    });

    // Assignable parents: admins → all active users; others → self + downline.
    const isAdmin = primaryRole === "admin" || primaryRole === "super_admin";
    let parents: { id: string; name: string }[] = [];
    let teams: { id: string; name: string }[] = [];
    if (allowedRoles.length > 0) {
      let profQ = supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("is_active", true);
      if (!isAdmin) {
        const { data: desc } = await (supabase as any).rpc("descendant_ids", { _root: userId });
        const ids = [userId, ...((desc ?? []) as { id: string }[]).map((d) => d.id)];
        profQ = profQ.in("id", ids);
      }
      const { data: profs } = await profQ;
      const ids = ((profs ?? []) as any[]).map((p) => p.id);
      const { data: parentRoles } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] };
      const eligibleIds = new Set(
        ((parentRoles ?? []) as { user_id: string; role: string }[])
          .filter((row) => ["leader", "manager", "admin", "super_admin"].includes(row.role))
          .map((row) => row.user_id),
      );
      parents = ((profs ?? []) as any[]).filter((p) => eligibleIds.has(p.id)).map((p) => ({
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed",
      }));
      const { data: teamRows } = await supabase.from("teams").select("id, name").order("name");
      teams = (teamRows ?? []) as { id: string; name: string }[];
    }
    return { canInvite: allowedRoles.length > 0, allowedRoles, parents, teams };
  });

const inviteSchema = z.object({
  first_name: z.string().trim().max(80).optional().or(z.literal("")),
  last_name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  role: z.enum(["agent", "leader", "manager"]),
  parent_user_id: z.string().uuid().optional().or(z.literal("")),
  team_id: z.string().uuid().optional().or(z.literal("")),
  state: z.string().trim().max(4).optional().or(z.literal("")),
  licensed: z.boolean().optional(),
  npn: z.string().trim().max(40).optional().or(z.literal("")),
  instagram_handle: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  can_invite_agents: z.boolean().optional(),
  can_invite_leaders: z.boolean().optional(),
  can_manage_resources: z.boolean().optional(),
  applicant_id: z.string().uuid().optional().or(z.literal("")),
});

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.parent_user_id) await assertEligibleUpline(data.parent_user_id);
    const { data: res, error } = await (supabase as any).rpc("create_invitation", {
      payload: data,
    });
    if (error) throw new Error(error.message);
    await writeAudit(supabase, {
      action: "user_invited",
      actor_id: userId,
      new_value: { email: data.email, role: data.role },
    });
    return res as { id: string; token: string };
  });

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("invitations")
      .select(
        "id, email, first_name, last_name, role, status, expires_at, created_at, accepted_at, token, parent_user_id, invited_by, team_id",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { invitations: data ?? [] };
  });

export const cancelInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await (supabase as any).rpc("cancel_invitation", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: res, error } = await (supabase as any).rpc("resend_invitation", { _id: data.id });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; token: string };
  });

export type PublicInvitation = {
  found: boolean;
  status?: "pending" | "accepted" | "expired" | "cancelled";
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string;
  state?: string | null;
  licensed?: boolean;
  npn?: string | null;
  instagram_handle?: string | null;
  phone?: string | null;
};

/** Public: safe invitation details for the acceptance page. */
export const getInvitationPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: res, error } = await (supabase as any).rpc("get_invitation_public", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    return (res ?? { found: false }) as PublicInvitation;
  });

const acceptSchema = z.object({
  token: z.string().min(10).max(128),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  state: z.string().trim().max(4).optional().or(z.literal("")),
  licensed: z.boolean().optional(),
  npn: z.string().trim().max(40).optional().or(z.literal("")),
  instagram_handle: z.string().trim().max(80).optional().or(z.literal("")),
  timezone: z.string().trim().max(64).optional().or(z.literal("")),
  accept_terms: z.literal(true),
});

/** Public: create the auth account + wire the profile from an invitation. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => acceptSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate the token server-side and get the invitee email.
    const { data: inv, error: invErr } = await (supabaseAdmin as any).rpc("get_invitation_public", {
      _token: data.token,
    });
    if (invErr) throw new Error(invErr.message);
    const invitation = (inv ?? { found: false }) as PublicInvitation;
    if (!invitation.found) throw new Error("This invitation link is invalid.");
    if (invitation.status !== "pending") throw new Error("This invitation is no longer available.");
    const email = invitation.email!;

    // Create the Supabase Auth account (handle_new_user trigger creates the profile).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: invitation.first_name ?? "",
        last_name: invitation.last_name ?? "",
      },
    });
    if (createErr || !created?.user) {
      throw new Error(
        createErr?.message || "Could not create your account. The email may already be in use.",
      );
    }

    // Wire the new profile into the hierarchy and grant the role (single-uses token).
    const { error: finErr } = await (supabaseAdmin as any).rpc("finalize_invitation_acceptance", {
      payload: {
        token: data.token,
        profile_id: created.user.id,
        phone: data.phone ?? "",
        state: data.state ?? "",
        licensed: data.licensed ?? invitation.licensed ?? false,
        npn: data.npn ?? "",
        instagram_handle: data.instagram_handle ?? "",
        timezone: data.timezone ?? "",
      },
    });
    if (finErr) {
      // Roll back the auth account so the token can be retried.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw new Error(finErr.message);
    }

    return { ok: true, email };
  });

const promoteSchema = z.object({
  applicant_id: z.string().uuid(),
  role: z.enum(["agent", "leader"]).optional(),
  parent_user_id: z.string().uuid().optional().or(z.literal("")),
  team_id: z.string().uuid().optional().or(z.literal("")),
  first_name: z.string().trim().max(80).optional().or(z.literal("")),
  last_name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  state: z.string().trim().max(4).optional().or(z.literal("")),
  licensed: z.boolean().optional(),
});

/** Promote an applicant to an agent: creates a secure invitation + moves the
 *  applicant to Active Agent. Never creates the portal account directly. */
export const promoteApplicantToAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => promoteSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.parent_user_id) await assertEligibleUpline(data.parent_user_id);
    const { data: res, error } = await (supabase as any).rpc("promote_applicant_to_agent", {
      payload: data,
    });
    if (error) throw new Error(error.message);
    await writeAudit(supabase, {
      action: "applicant_promoted",
      actor_id: userId,
      target_applicant_id: data.applicant_id,
      new_value: { role: data.role ?? "agent" },
    });
    return res as { ok: boolean; invitation_id: string; token: string };
  });

export { ROLE_RANK };

async function assertEligibleUpline(profileId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", profileId);
  const eligible = ((data ?? []) as { role: string }[]).some((row) =>
    ["leader", "manager", "admin", "super_admin"].includes(row.role),
  );
  if (!eligible) throw new Error("Choose an active leader or manager as the upline.");
}
