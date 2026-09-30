import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { adminListUsers, adminSetUserRole, adminUpdateProfile, saveAgentLink, deleteAgentLink } from "@/lib/portal.functions";
import { useState } from "react";
import {
  PageHeader, PageBody, Toolbar, SearchField, TableWrap, Table, THead, TH, TR, TD,
  Badge, Select, Input, TableSkeleton, ErrorState, EmptyState, notify, Panel,
  Modal, Button, Field, Divider,
} from "@/components/portal/ui";

type LinkRow = { id: string; owner_id: string; label: string; url: string; is_active: boolean };

export const Route = createFileRoute("/_authenticated/portal/admin/users")({
  head: () => ({ meta: [{ title: "Users — Vantage Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsersPage,
});

// super_admin is a protected internal owner level and is never selectable here.
const ROLES = ["agent", "leader", "manager", "admin"] as const;
type RoleName = (typeof ROLES)[number];

function UsersPage() {
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetUserRole);
  const updateProfile = useServerFn(adminUpdateProfile);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const usersQ = useQuery({ queryKey: ["admin", "users"], queryFn: () => list() });
  const { data, isLoading } = usersQ;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: RoleName; grant: boolean }) => setRole({ data: v }),
    onSuccess: invalidate,
  });
  const profileMut = useMutation({
    mutationFn: (v: Record<string, unknown> & { id: string }) => updateProfile({ data: v }),
    onSuccess: invalidate,
    onError: () => notify.error("Could not update that user.", "Please try again."),
  });

  const allUsers = data?.users ?? [];
  const agentLinks: LinkRow[] = (data?.agentLinks ?? []) as LinkRow[];
  const uplineUsers = allUsers.filter((candidate: any) =>
    candidate.is_active !== false && candidate.roles.some((role: string) => ["leader", "manager", "admin", "super_admin"].includes(role)),
  );
  const users = allUsers.filter((u: any) => {
    if (!q.trim()) return true;
    const n = `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.email ?? ""}`.toLowerCase();
    return n.includes(q.toLowerCase());
  });

  const [manageOwnerId, setManageOwnerId] = useState<string | null>(null);
  const displayName = (id: string | null | undefined) => {
    const p = allUsers.find((row: any) => row.id === id);
    if (!p) return "this upline";
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "this upline";
  };
  const isUpline = (u: any) =>
    u.roles.some((role: string) => ["leader", "manager", "admin", "super_admin"].includes(role));

  const linkCell = (u: any) => (
    <AgentLinkCell
      user={u}
      links={agentLinks}
      uplineName={displayName(u.parent_user_id)}
      canManageSelf={isUpline(u)}
      onAssign={(linkId) => profileMut.mutate({ id: u.id, assigned_agentlink_link_id: linkId })}
      onManage={(ownerId) => setManageOwnerId(ownerId)}
    />
  );

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Users & roles" description="Grant admin, manager, or agent access; toggle activation and teams." />
        <Toolbar className="mb-4">
          <SearchField value={q} onChange={setQ} placeholder="Search name or email…" />
          <div className="ml-auto p-muted">{users.length} user(s)</div>
        </Toolbar>

        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : usersQ.isError ? (
          <TableWrap>
            <ErrorState description="We couldn't load users." onRetry={() => usersQ.refetch()} />
          </TableWrap>
        ) : (
          <>
          {/* Phones get stacked cards — a six-column admin table is unusable there. */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {users.length === 0 && (
              <Panel>
                <EmptyState title="No users match" description="Try a different name or email." />
              </Panel>
            )}
            {users.map((u: any) => (
              <Panel key={u.id}>
                <div className="min-w-0">
                  <Link
                    to="/portal/admin/users/$userId"
                    params={{ userId: u.id }}
                    className="p-card-title truncate hover:underline"
                  >
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                  </Link>
                  <div className="p-muted truncate">{u.email}</div>
                  {u.roles.includes("super_admin") && (
                    <Badge tone="gold" className="mt-1">Owner</Badge>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ROLES.map((r) => {
                    const on = u.roles.includes(r);
                    return (
                      <button
                        key={r}
                        disabled={roleMut.isPending}
                        onClick={() => roleMut.mutate({ user_id: u.id, role: r, grant: !on })}
                        className="p-focus min-h-[40px] rounded-full border px-3 text-[13px] font-medium capitalize transition"
                        style={
                          on
                            ? { borderColor: "var(--p-gold-line)", background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                            : { borderColor: "var(--p-border)", color: "var(--p-text-3)" }
                        }
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <div className="p-label mb-1">Reports to</div>
                  <Select
                    value={u.parent_user_id ?? ""}
                    onChange={(e) =>
                      profileMut.mutate({ id: u.id, parent_user_id: e.target.value || null })
                    }
                  >
                    <option value="">— none —</option>
                    {uplineUsers
                      .filter((p: any) => p.id !== u.id)
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="mt-3">
                  <div className="p-label mb-1">AgentLink assignment</div>
                  {linkCell(u)}
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <PermToggle
                    label="Invite agents"
                    checked={!!u.can_invite_agents}
                    onChange={(v) => profileMut.mutate({ id: u.id, can_invite_agents: v })}
                  />
                  <PermToggle
                    label="Invite leaders"
                    checked={!!u.can_invite_leaders}
                    onChange={(v) => profileMut.mutate({ id: u.id, can_invite_leaders: v })}
                  />
                  <PermToggle
                    label="Manage resources"
                    checked={!!u.can_manage_resources}
                    onChange={(v) => profileMut.mutate({ id: u.id, can_manage_resources: v })}
                  />
                </div>

                <div className="mt-3">
                  <div className="p-label mb-1">Recruiting link</div>
                  <SlugCell
                    slug={u.recruiting_slug ?? ""}
                    disabled={profileMut.isPending}
                    onSave={(slug) => profileMut.mutate({ id: u.id, recruiting_slug: slug })}
                  />
                  <div className="mt-2">
                    <PermToggle
                      label="Can receive applicants"
                      checked={u.can_receive_applicants !== false}
                      onChange={(v) => profileMut.mutate({ id: u.id, can_receive_applicants: v })}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <PermToggle
                    label={u.is_active !== false ? "Active" : "Inactive"}
                    checked={u.is_active !== false}
                    onChange={(v) => profileMut.mutate({ id: u.id, is_active: v })}
                  />
                </div>
              </Panel>
            ))}
          </div>

          <TableWrap className="hidden sm:block">
            <Table className="min-w-[900px]">
              <THead>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Reports to</TH>
                <TH>Permissions</TH>
                <TH>Recruiting link</TH>
                <TH>Status</TH>
              </THead>
              <tbody>
                {users.map((u: any) => (
                  <TR key={u.id} className="align-top">
                    <TD>
                      <Link
                        to="/portal/admin/users/$userId"
                        params={{ userId: u.id }}
                        className="p-card-title hover:underline"
                      >
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                      </Link>
                      <div className="p-muted">{u.email}</div>
                      {u.roles.includes("super_admin") && (
                        <Badge tone="gold" className="mt-1">Owner</Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        {ROLES.map((r) => {
                          const on = u.roles.includes(r);
                          return (
                            <button
                              key={r}
                              disabled={roleMut.isPending}
                              onClick={() => roleMut.mutate({ user_id: u.id, role: r, grant: !on })}
                              className="p-focus rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize transition"
                              style={
                                on
                                  ? { borderColor: "var(--p-gold-line)", background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                                  : { borderColor: "var(--p-border)", color: "var(--p-text-3)" }
                              }
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </TD>
                    <TD>
                      <Select
                        className="h-9 w-44 text-[13px]"
                        value={u.parent_user_id ?? ""}
                        onChange={(e) =>
                          profileMut.mutate({ id: u.id, parent_user_id: e.target.value || null })
                        }
                      >
                        <option value="">— none —</option>
                        {uplineUsers
                          .filter((p: any) => p.id !== u.id)
                          .map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                            </option>
                          ))}
                      </Select>
                      <div className="mt-2 w-44">{linkCell(u)}</div>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-1.5">
                        <PermToggle
                          label="Invite agents"
                          checked={!!u.can_invite_agents}
                          onChange={(v) => profileMut.mutate({ id: u.id, can_invite_agents: v })}
                        />
                        <PermToggle
                          label="Invite leaders"
                          checked={!!u.can_invite_leaders}
                          onChange={(v) => profileMut.mutate({ id: u.id, can_invite_leaders: v })}
                        />
                        <PermToggle
                          label="Manage resources"
                          checked={!!u.can_manage_resources}
                          onChange={(v) => profileMut.mutate({ id: u.id, can_manage_resources: v })}
                        />
                      </div>
                    </TD>
                    <TD>
                      <SlugCell
                        slug={u.recruiting_slug ?? ""}
                        disabled={profileMut.isPending}
                        onSave={(slug) => profileMut.mutate({ id: u.id, recruiting_slug: slug })}
                      />
                      <PermToggle
                        label="Can receive applicants"
                        checked={u.can_receive_applicants !== false}
                        onChange={(v) => profileMut.mutate({ id: u.id, can_receive_applicants: v })}
                      />
                    </TD>
                    <TD>
                      <label className="p-secondary inline-flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={u.is_active !== false}
                          onChange={(e) =>
                            profileMut.mutate({ id: u.id, is_active: e.target.checked })
                          }
                        />
                        {u.is_active !== false ? "Active" : "Inactive"}
                      </label>
                    </TD>
                  </TR>
                ))}
                {users.length === 0 && (
                  <TR>
                    <TD colSpan={6}>
                      <EmptyState title="No users match" description="Try a different name or email." />
                    </TD>
                  </TR>
                )}
              </tbody>
            </Table>
          </TableWrap>
          </>
        )}
      </PageBody>
    </PortalShell>
  );
}

function PermToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="p-secondary inline-flex items-center gap-2 text-[12px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SlugCell({
  slug,
  disabled,
  onSave,
}: {
  slug: string;
  disabled: boolean;
  onSave: (slug: string) => void;
}) {
  const [value, setValue] = useState(slug);
  const dirty = value.trim() !== slug;
  return (
    <div className="flex items-center gap-2">
      <Input
        className="h-9 w-40 text-[13px]"
        value={value}
        placeholder="recruiting-slug"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      {dirty && value.trim() && (
        <button
          onClick={() => onSave(value.trim().toLowerCase())}
          disabled={disabled}
          className="p-focus text-[12px] font-semibold disabled:opacity-50"
          style={{ color: "var(--p-gold)" }}
        >
          Save
        </button>
      )}
    </div>
  );
}
