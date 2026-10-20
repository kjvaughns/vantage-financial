import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { VantageLogo } from "@/components/vantage/brand";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, addAgent, getMyOnboarding, getMyRecruitingLink } from "@/lib/portal.functions";
import { AddAgentModal } from "@/components/vantage/add-agent-modal";
import { NewContentBadge } from "@/components/vantage/new-content-badge";
import { getNewContentDates } from "@/lib/new-content.functions";
import { useTheme } from "@/components/vantage/theme";
import { Avatar, Badge, btnClass } from "@/components/portal/ui";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Trophy,
  GraduationCap,
  Network,
  Settings,
  Rocket,
  Target,
  Mic,
  UserPlus,
  ShieldCheck,
  ScrollText,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon };

/** Grouped so the sidebar reads as day-to-day work, growth, then account. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Work",
    items: [
      { to: "/portal", label: "Dashboard", icon: LayoutDashboard },
      { to: "/portal/applicants", label: "Applicants", icon: Users },
      { to: "/portal/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/portal/training", label: "Training Hub", icon: Target },
      { to: "/portal/academy", label: "Academy", icon: GraduationCap },
      { to: "/portal/leaderboard", label: "Leaderboard", icon: Trophy },
      { to: "/portal/organization", label: "Organization", icon: Network },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/portal/settings", label: "My Settings", icon: Settings }],
  },
];

const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);


const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  leader: "Leader",
  agent: "Agent",
};

/** Compact sidebar row. Active state is a subtle gold tint — no heavy outline. */
function NavRow({
  to,
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
  accent,
  badge,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  accent?: boolean;
  badge?: ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`p-focus mb-0.5 flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-2.5 text-[15px] font-medium transition md:h-[38px] md:min-h-0 md:text-[14px] ${
        collapsed ? "justify-center" : ""
      } ${active ? "" : "hover:bg-[var(--p-hover)]"}`}
      style={
        active
          ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" }
          : { color: accent ? "var(--p-gold)" : "var(--p-text-2)" }
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && badge && <span className="shrink-0">{badge}</span>}
    </Link>
  );
}


function GroupLabel({ children, hidden }: { children: ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div
      className="mt-4 mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: "var(--p-text-3)" }}
    >
      {children}
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle: toggleTheme } = useTheme();

  // Persist sidebar collapse across navigations/reloads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("vantage_sidebar_collapsed") === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("vantage_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const fetchMe = useServerFn(getMe);
  const fetchContentDates = useServerFn(getNewContentDates);
  const contentDatesQ = useQuery({ queryKey: ["new-content-dates"], queryFn: () => fetchContentDates(), refetchInterval: 60_000, staleTime: 0 });
  const addAgentFn = useServerFn(addAgent);
  const fetchOnboarding = useServerFn(getMyOnboarding);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const onboardingQ = useQuery({ queryKey: ["my-onboarding"], queryFn: () => fetchOnboarding() });
  const fetchMyLink = useServerFn(getMyRecruitingLink);
  const myLinkQ = useQuery({ queryKey: ["my-recruiting-link"], queryFn: () => fetchMyLink() });
  const agentInviteLink =
    myLinkQ.data?.recruiting_slug && typeof window !== "undefined"
      ? `${window.location.origin}/join/${myLinkQ.data.recruiting_slug}`
      : null;
  const onb = onboardingQ.data;
  const onbInProgress = !!onb?.hasOnboarding && !onb.complete;
  const onboardingBadge = onb?.hasOnboarding ? (
    onb.complete ? (
      <Badge tone="green">Done</Badge>
    ) : (
      <Badge tone="gold">
        {onb.done}/{onb.total}
      </Badge>
    )
  ) : null;

  // Close the mobile drawer on Escape and when the route changes. While it is
  // open the page behind it can't scroll, and focus moves into the panel so a
  // keyboard/screen-reader user isn't left behind the overlay.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sidebarRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/login", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const profile = meQ.data?.profile;
  const roles = meQ.data?.roles ?? [];
  const isAdmin = roles.some((r) => r === "admin" || r === "super_admin");
  // Every portal user can invite agents.
  const canInvite = true;
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Agent";
  const primaryRole =
    roles.find((r) => r === "super_admin") ??
    roles.find((r) => r === "admin") ??
    roles.find((r) => r === "manager") ??
    roles.find((r) => r === "leader") ??
    roles[0];

  const current =
    [...NAV]
      .sort((a, b) => b.to.length - a.to.length)
      .find((n) => (n.to === "/portal" ? path === "/portal" : path.startsWith(n.to)))?.label ??
    (path.startsWith("/portal/admin")
      ? "Admin"
      : path.startsWith("/portal/onboarding")
        ? "Onboarding"
        : "Portal");

  return (
    <div
      className={`vantage-portal relative min-h-dvh ${theme === "light" ? "vantage-theme-light" : ""}`}
      style={{ background: "var(--p-bg)", color: "var(--p-text)" }}
    >
      <div className="relative flex">
        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          tabIndex={-1}
          id="portal-sidebar"
          aria-label="Portal navigation"
          
          className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} p-safe-t p-safe-b fixed inset-y-0 left-0 z-50 flex ${
            collapsed ? "w-[64px]" : "w-[264px] md:w-[240px]"
          } flex-col border-r transition-[width,transform] outline-none md:sticky md:top-0 md:h-dvh md:translate-x-0`}
          style={{ background: "var(--p-sidebar)", borderColor: "var(--p-border)" }}
        >
          <div
            className={`flex h-[56px] shrink-0 items-center gap-2 border-b ${collapsed ? "justify-center px-2" : "px-4"}`}
            style={{ borderColor: "var(--p-border)" }}
          >
            <VantageLogo className="vantage-brand-mark h-7 w-auto" />
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`${btnClass("ghost", "sm")} ml-auto hidden md:inline-flex`}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <NavRow
              to="/portal/onboarding"
              icon={Rocket}
              label="Onboarding"
              accent={onbInProgress}
              badge={onboardingBadge}
              active={path.startsWith("/portal/onboarding")}
              collapsed={collapsed}
              onClick={() => setMobileOpen(false)}
            />
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <GroupLabel hidden={collapsed}>{group.label}</GroupLabel>
                {group.items.map((n) => (
                  <NavRow
                    key={n.to}
                    to={n.to}
                    icon={n.icon}
                    label={n.label}
                    badge={n.to === "/portal/academy" ? <NewContentBadge createdAt={contentDatesQ.data?.academy} /> : n.to === "/portal/training" ? <NewContentBadge createdAt={contentDatesQ.data?.training} /> : undefined}
                    active={n.to === "/portal" ? path === "/portal" : path.startsWith(n.to)}
                    collapsed={collapsed}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            ))}

            {canInvite && (
              <>
                <GroupLabel hidden={collapsed}>Management</GroupLabel>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setAddAgentOpen(true);
                  }}
                  title={collapsed ? "Add Agent" : undefined}
                  className={`p-focus mb-0.5 flex min-h-[44px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[15px] font-medium transition hover:bg-[var(--p-hover)] md:h-[38px] md:min-h-0 md:text-[14px] ${
                    collapsed ? "justify-center" : ""
                  }`}
                  style={{ color: "var(--p-gold)" }}
                >
                  <UserPlus className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {!collapsed && <span>Add Agent</span>}
                </button>
              </>
            )}

            {isAdmin && (
              <>
                <GroupLabel hidden={collapsed}>Admin</GroupLabel>
                <NavRow
                  to="/portal/admin"
                  icon={ShieldCheck}
                  label="Admin"
                  active={
                    path.startsWith("/portal/admin") &&
                    !path.startsWith("/portal/admin/audit") &&
                    !path.startsWith("/portal/admin/emails")
                  }
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
                <NavRow
                  to="/portal/admin/emails"
                  icon={Mail}
                  label="Emails"
                  active={path.startsWith("/portal/admin/emails")}
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
                <NavRow
                  to="/portal/admin/audit"
                  icon={ScrollText}
                  label="Audit Log"
                  active={path.startsWith("/portal/admin/audit")}
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
              </>
            )}
          </nav>

          <div className="shrink-0 border-t p-2" style={{ borderColor: "var(--p-border)" }}>
            <div
              className={`flex items-center gap-2.5 rounded-[8px] px-1.5 py-2 ${collapsed ? "justify-center" : ""}`}
            >
              <Avatar name={displayName} email={profile?.email} size={30} />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">{displayName}</span>
                    {/* The header badge is desktop-only, so the role lives here on phones. */}
                    {primaryRole && (
                      <Badge tone="neutral" className="shrink-0 sm:hidden">
                        {ROLE_LABEL[primaryRole] ?? primaryRole}
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-[11.5px]" style={{ color: "var(--p-text-3)" }}>
                    {profile?.email}
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={signOut}
                className={`${btnClass("secondary", "sm")} mt-1 min-h-[44px] w-full md:min-h-0`}
              >
                Sign out
              </button>
            )}
          </div>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header
            className="p-safe-t sticky top-0 z-30 flex h-[56px] shrink-0 items-center gap-2 border-b px-3 backdrop-blur-xl sm:gap-3 md:px-6"
            style={{
              borderColor: "var(--p-border)",
              background: "color-mix(in oklab, var(--p-bg) 88%, transparent)",
            }}
          >
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              aria-controls="portal-sidebar"
              className={`${btnClass("ghost", "sm")} min-h-[44px] min-w-[44px] text-[18px] md:hidden`}
            >
              ☰
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{current}</div>
            </div>
            {primaryRole && (
              <Badge tone="neutral" className="hidden sm:inline-flex">
                {ROLE_LABEL[primaryRole] ?? primaryRole}
              </Badge>
            )}
            {canInvite && (
              <button
                onClick={() => setAddAgentOpen(true)}
                aria-label="Add agent"
                className={`${btnClass("primary", "sm")} min-h-[44px] min-w-[44px] px-0 sm:min-h-0 sm:min-w-0 sm:px-2.5`}
              >
                <UserPlus className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">＋ Add Agent</span>
              </button>
            )}
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={`${btnClass("ghost", "sm")} min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <Avatar name={displayName} email={profile?.email} size={28} />
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      {addAgentOpen && (
        <AddAgentModal
          inviteLink={agentInviteLink}
          onClose={() => setAddAgentOpen(false)}
          onSubmit={async (fields) => {
            const res = await addAgentFn({
              data: {
                full_name: `${fields.first_name} ${fields.last_name}`.trim(),
                email: fields.email,
                phone: fields.phone,
              },
            });
            setAddAgentOpen(false);
            qc.invalidateQueries({ queryKey: ["applicants"] });
            toast.success("Agent added — onboarding invite sent.", {
              action: {
                label: "View record",
                onClick: () =>
                  navigate({ to: "/portal/crm/$applicantId", params: { applicantId: res.id } }),
              },
            });
          }}
        />
      )}

    </div>
  );
}

/**
 * Legacy page header kept for API compatibility with existing routes. Restyled
 * as a compact operational header (no oversized display type, no gold kicker).
 */
export function PortalHeader({
  title,
  kicker,
  actions,
}: {
  title: string;
  kicker?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="px-4 pt-5 pb-1 md:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="p-title truncate">{title}</h1>
          {kicker && (
            <div className="p-secondary mt-1 truncate">
              {kicker.charAt(0) + kicker.slice(1).toLowerCase()}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
