import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, TableWrap, Table, THead, TH, TR, TD } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/admin/")({
  head: () => ({ meta: [{ title: "Admin — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: AdminHome,
});

const CARDS: { to: "/portal/admin/users" | "/portal/admin/stages" | "/portal/admin/settings" | "/portal/admin/onboarding"; label: string; desc: string; icon: string }[] = [
  { to: "/portal/admin/users", label: "Users & Roles", desc: "Grant admin, manager, or agent access; toggle activation and teams.", icon: "◐" },
  { to: "/portal/admin/onboarding", label: "Onboarding & Training", desc: "Build the new agent checklist, weekly schedule, and shared links.", icon: "✓" },
  { to: "/portal/admin/stages", label: "Pipeline Stages", desc: "Configure the recruiting pipeline stages, colors, and order.", icon: "▤" },
  { to: "/portal/admin/settings", label: "System Settings", desc: "Global platform configuration and defaults.", icon: "⚙" },
];


function AdminHome() {
  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Admin" description="Platform controls" />
        <TableWrap>
          <Table>
            <THead>
              <TH>Area</TH>
              <TH>Description</TH>
              <TH align="right" />
            </THead>
            <tbody>
              {CARDS.map((c) => (
                <TR key={c.to}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[14px]"
                        style={{ background: "var(--p-gold-soft)", color: "var(--p-gold)" }}
                      >
                        {c.icon}
                      </span>
                      <span className="p-card-title truncate">{c.label}</span>
                    </div>
                  </TD>
                  <TD className="p-secondary">{c.desc}</TD>
                  <TD align="right">
                    <Link
                      to={c.to}
                      className="p-focus text-[13px] font-semibold"
                      style={{ color: "var(--p-gold)" }}
                    >
                      Manage →
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </PageBody>
    </PortalShell>
  );
}
