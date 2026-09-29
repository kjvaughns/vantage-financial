import { createFileRoute } from "@tanstack/react-router";
import { formatPhoneInput } from "@/lib/phone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { listEmailCampaigns, setCampaignSubscription } from "@/lib/email.functions";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  FormGrid,
  SegmentedControl,
  Badge,
  Avatar,
  btnClass,
  SectionNav,
  Tabs,
  Toggle,
  TextSkeleton,
  ListSkeleton,
  ErrorState,
  notify,
} from "@/components/portal/ui";
import {
  getMe,
  updateMyProfile,
  updateMyNotificationPrefs,
  getMySchedulingSettings,
  updateMySchedulingSettings,
  getTeamRecruitingLinks,
  getAgentLinkSettings,
  saveAgentLink,
  deleteAgentLink,
  assignAgentLink,
} from "@/lib/portal.functions";
import { CalendlyInline } from "@/components/vantage/calendly-inline";
import { RecruitingLinkCard } from "@/components/vantage/recruiting-link-card";
import { useTheme } from "@/components/vantage/theme";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  head: () => ({
    meta: [{ title: "Settings — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalSettingsPage,
});

type Section = "profile" | "security" | "notifications" | "appearance" | "recruiting";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "recruiting", label: "Recruiting" },
];

function PortalSettingsPage() {
  const [section, setSection] = useState<Section>("profile");

  const content = (
    <>
      {section === "profile" && <ProfileSection />}
      {section === "security" && <SecuritySection />}
      {section === "notifications" && <NotificationsSection />}
      {section === "appearance" && <AppearanceSection />}
      {section === "recruiting" && <RecruitingSection />}
    </>
  );

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Settings" description="Manage your profile, security, and preferences." />

        <div className="mb-4 sm:hidden">
          <Tabs
            tabs={SECTIONS.map((s) => ({ value: s.key, label: s.label }))}
            value={section}
            onChange={setSection}
          />
        </div>

        <div className="hidden gap-4 sm:grid sm:grid-cols-[200px_minmax(0,1fr)] sm:items-start">
          <div className="p-panel p-1.5">
            <SectionNav
              items={SECTIONS.map((s) => ({ value: s.key, label: s.label }))}
              value={section}
              onChange={setSection}
            />
          </div>
          <div className="min-w-0 space-y-4">{content}</div>
        </div>

        <div className="space-y-4 sm:hidden">{content}</div>
      </PageBody>
    </PortalShell>
  );
}

/* ---------------- Profile ---------------- */

function ProfileSection() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const saveFn = useServerFn(updateMyProfile);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const profile = meQ.data?.profile as any;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [npn, setNpn] = useState("");
  const [residentState, setResidentState] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
    setNpn(profile.npn ?? "");
    setResidentState(profile.resident_state ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  const save = useMutation({
    mutationFn: () => {
      if (phone.trim() && !/^[\d\s()+.-]{7,}$/.test(phone.trim())) {
        throw new Error("Please enter a valid phone number.");
      }
      return saveFn({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          npn: npn.trim(),
          resident_state: residentState.trim(),
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      notify.success("Profile saved.");
    },
    onError: () => notify.error("Could not save your profile.", "Please try again."),
  });

  async function onAvatar(file: File) {
    if (!profile?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      // The avatars bucket is public — store the public URL.
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      if (!url) throw new Error("Could not resolve upload URL.");
      await saveFn({ data: { avatar_url: url } });
      setAvatarUrl(url);
      qc.invalidateQueries({ queryKey: ["me"] });
      notify.success("Photo updated.");
    } catch {
      notify.error("Could not upload your photo.", "Please try a different image.");
    } finally {
      setUploading(false);
    }
  }

  if (meQ.isError) {
    return (
      <Panel title="Profile">
        <ErrorState description="We couldn't load your profile." onRetry={() => meQ.refetch()} />
      </Panel>
    );
  }

  if (meQ.isLoading) {
    return (
      <Panel title="Profile">
        <TextSkeleton lines={5} />
      </Panel>
    );
  }

  return (
    <Panel title="Profile">
      <div className="flex items-center gap-4">
        <Avatar name={`${firstName} ${lastName}`.trim()} src={avatarUrl} size={56} />
        <label className={btnClass("secondary", "sm") + " cursor-pointer"}>
          {uploading ? "Uploading…" : "Change photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAvatar(f);
            }}
          />
        </label>
      </div>

      <FormGrid className="mt-5">
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />
        </Field>
        <Field label="Email (read-only)">
          <Input readOnly value={profile?.email ?? ""} className="opacity-70" />
        </Field>
        <Field label="NPN">
          <Input value={npn} onChange={(e) => setNpn(e.target.value)} placeholder="National Producer Number" />
        </Field>
        <Field label="Resident state">
          <Input value={residentState} onChange={(e) => setResidentState(e.target.value)} placeholder="e.g. TX" />
        </Field>
      </FormGrid>

      <Button variant="primary" className="mt-5" loading={save.isPending} onClick={() => save.mutate()}>
        Save profile
      </Button>
    </Panel>
  );
}

/* ---------------- Security ---------------- */

function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setLastSignIn(data.user?.last_sign_in_at ?? null);
    });
  }, []);

  const valid = !!current && pw.length >= 8 && pw === confirm;

  async function changePassword() {
    if (!valid || !email) return;
    setBusy(true);
    try {
      // Re-authenticate with the current password before changing it.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (reauthErr) throw new Error("Current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setCurrent("");
      setPw("");
      setConfirm("");
      notify.success("Password updated.");
    } catch {
      notify.error("Could not update your password.", "Check your current password and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Change password" description="You'll need your current password to set a new one.">
        <div className="grid gap-4">
          <Field label="Current password" hint="Confirms it's really you before we change anything.">
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Your current password" />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field
            label="Confirm new password"
            error={confirm && pw !== confirm ? "Passwords don't match." : undefined}
          >
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button variant="primary" className="w-fit" loading={busy} disabled={!valid} onClick={changePassword}>
            Update password
          </Button>
        </div>
      </Panel>

      <Panel title="Session" description="Where you're currently signed in.">
        <div className="flex items-center justify-between gap-4 py-1">
          <span className="p-body">Last sign-in</span>
          <span className="p-secondary" style={{ color: "var(--p-text)" }}>
            {lastSignIn ? new Date(lastSignIn).toLocaleString() : "—"}
          </span>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Notifications ---------------- */

const NOTIF_EVENTS: { key: string; label: string; def: boolean }[] = [
  { key: "email_notifications", label: "Email notifications", def: true },
  { key: "recruiting_updates", label: "Recruiting updates", def: true },
  { key: "applicant_follow_ups", label: "Applicant follow-ups", def: true },
  { key: "training_reminders", label: "Training reminders", def: true },
  { key: "meeting_reminders", label: "Meeting reminders", def: true },
  { key: "agency_announcements", label: "Agency announcements", def: true },
  { key: "onboarding_updates", label: "Onboarding updates", def: true },
];

function NotificationsSection() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const saveFn = useServerFn(updateMyNotificationPrefs);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const stored = (meQ.data?.profile as any)?.notification_prefs as Record<string, boolean> | null;

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const base: Record<string, boolean> = {};
    for (const e of NOTIF_EVENTS) base[e.key] = stored?.[e.key] ?? e.def;
    setPrefs(base);
  }, [stored]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { prefs } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      notify.success("Notification preferences saved.");
    },
    onError: () => notify.error("Could not save your preferences.", "Please try again."),
  });

  if (meQ.isError) {
    return (
      <Panel title="Notifications">
        <ErrorState description="We couldn't load your preferences." onRetry={() => meQ.refetch()} />
      </Panel>
    );
  }

  if (meQ.isLoading) {
    return (
      <Panel title="Notifications">
        <ListSkeleton rows={NOTIF_EVENTS.length} />
      </Panel>
    );
  }

  return (
    <>
      <Panel
        title="Notifications"
        description="Choose which updates you receive. Preferences are saved to your profile and applied wherever notifications are sent."
      >
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--p-border)" }}>
          {NOTIF_EVENTS.map((e) => (
            <div key={e.key} className="py-3">
              <Toggle
                checked={!!prefs[e.key]}
                onChange={(v) => setPrefs((p) => ({ ...p, [e.key]: v }))}
                label={e.label}
              />
            </div>
          ))}
        </div>
        <Button variant="primary" className="mt-5" loading={save.isPending} onClick={() => save.mutate()}>
          Save preferences
        </Button>
      </Panel>
      <CampaignSubscriptions />
    </>
  );
}

/** Opt in or out of the recurring agent emails (daily focus, weekly plan, tips). */
function CampaignSubscriptions() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailCampaigns);
  const setFn = useServerFn(setCampaignSubscription);
  const q = useQuery({ queryKey: ["email", "campaigns"], queryFn: () => listFn() });
  const toggle = useMutation({
    mutationFn: (v: { slug: string; subscribed: boolean }) => setFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email", "campaigns"] });
      notify.success("Subscription updated.");
    },
    onError: () => notify.error("Could not update that subscription.", "Please try again."),
  });

  if (q.isLoading) {
    return (
      <Panel title="Recurring emails" className="mt-4">
        <ListSkeleton rows={3} />
      </Panel>
    );
  }
  const campaigns = (q.data ?? []).filter((c: any) => c.enabled && c.optional);
  if (!campaigns.length) return null;

  return (
    <Panel
      title="Recurring emails"
      description="Ongoing team emails you can opt out of at any time."
      className="mt-4"
    >
      <div className="flex flex-col divide-y" style={{ borderColor: "var(--p-border)" }}>
        {campaigns.map((c: any) => (
          <div key={c.slug} className="py-3">
            <Toggle
              checked={c.subscribed !== false}
              onChange={(v) => toggle.mutate({ slug: c.slug, subscribed: v })}
              label={c.name}
              description={c.schedule_label}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------- Appearance ---------------- */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <Panel title="Appearance" description="Choose how the portal looks. This preference is saved on this device.">
      <SegmentedControl
        options={[
          { value: "dark", label: "☾ Dark" },
          { value: "light", label: "☀ Light" },
        ]}
        value={theme}
        onChange={(v) => setTheme(v as "dark" | "light")}
      />
    </Panel>
  );
}

/* ---------------- Recruiting ---------------- */

const CALENDLY_RE = /^https:\/\/calendly\.com\/[A-Za-z0-9\-_/?&=.%#]+$/;

function RecruitingSection() {
  const getFn = useServerFn(getMySchedulingSettings);
  const saveFn = useServerFn(updateMySchedulingSettings);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me", "scheduling"], queryFn: () => getFn() });
  const save = useMutation({
    mutationFn: (v: { licensed_calendly_url: string }) => saveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "scheduling"] }),
  });

  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (q.data) setUrl(q.data.licensed_calendly_url ?? "");
  }, [q.data]);

  const isValid = url === "" || CALENDLY_RE.test(url);
  const status = !q.data ? "…" : url === "" ? "Not set" : !isValid ? "Invalid" : "Set";
  const canEdit = q.data?.can_edit ?? false;

  return (
    <div className="space-y-4">
      <RecruitingLinkCard />
      <TeamRecruitingLinksCard />
      <AgentLinkSettingsPanel />

      <Panel title="Licensed scheduling">
        {q.isLoading ? (
          <TextSkeleton lines={3} />
        ) : q.isError ? (
          <ErrorState description="We couldn't load this setting." onRetry={() => q.refetch()} />
        ) : !canEdit ? (
          <p className="p-secondary">
            Your account isn't permitted to schedule licensed applicants. Ask an administrator to
            enable this for you.
          </p>
        ) : (
          <>
            <Field label="Licensed applicant Calendly link">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  className="flex-1"
                  placeholder="https://calendly.com/your-name/interview"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button
                  variant="primary"
                  onClick={() => save.mutate({ licensed_calendly_url: url })}
                  disabled={!isValid || save.isPending}
                >
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </Field>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
              <Badge tone={status === "Set" ? "green" : status === "Invalid" ? "red" : "neutral"}>
                Status: {status}
              </Badge>
              {q.data?.licensed_calendly_updated_at && (
                <span className="p-muted">
                  Updated {new Date(q.data.licensed_calendly_updated_at).toLocaleString()}
                </span>
              )}
              {url && isValid && (
                <>
                  <a href={url} target="_blank" rel="noreferrer noopener" style={{ color: "var(--p-gold)" }} className="hover:underline">
                    Test link →
                  </a>
                  <button onClick={() => setPreview((v) => !v)} style={{ color: "var(--p-gold)" }} className="hover:underline">
                    {preview ? "Hide preview" : "Preview embed"}
                  </button>
                </>
              )}
            </div>
            {!isValid && url !== "" && (
              <p className="mt-3 text-[13px]" style={{ color: "var(--p-red)" }}>
                Must be a valid https://calendly.com/... URL.
              </p>
            )}
            {preview && url && isValid && <CalendlyInline url={url} height={640} />}
          </>
        )}
      </Panel>

      <OneOnOneLinkPanel />
    </div>
  );
}

function AgentLinkSettingsPanel() {
  const getFn = useServerFn(getAgentLinkSettings);
  const saveFn = useServerFn(saveAgentLink);
  const deleteFn = useServerFn(deleteAgentLink);
  const assignFn = useServerFn(assignAgentLink);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["agentlink", "settings"], queryFn: () => getFn() });
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["agentlink", "settings"] });
  const save = useMutation({
    mutationFn: () => saveFn({ data: { label, url, is_active: true } }),
    onSuccess: () => { setLabel(""); setUrl(""); refresh(); notify.success("AgentLink link saved."); },
    onError: () => notify.error("Could not save that AgentLink link.", "Check the URL and try again."),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteFn({ data: { id } }), onSuccess: refresh });
  const assign = useMutation({
    mutationFn: (value: { agent_id: string; link_id: string | null }) => assignFn({ data: value }),
    onSuccess: () => { refresh(); notify.success("AgentLink assignment saved."); },
    onError: () => notify.error("Could not assign that link.", "Choose one of your active links."),
  });

  if (q.isLoading || !q.data?.canManage) return null;
  const links = q.data.links ?? [];
  const agents = q.data.agents ?? [];
  const valid = label.trim().length > 0 && /^https:\/\/\S+$/i.test(url.trim());

  return (
    <Panel title="AgentLink contracting" description="Create your contracting links, then assign one link to each agent in your organization.">
      <FormGrid>
        <Field label="Link label"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Example: Main agency account" /></Field>
        <Field label="AgentLink URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></Field>
      </FormGrid>
      <Button className="mt-3" variant="primary" disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>Add link</Button>

      {links.length > 0 && (
        <div className="mt-5 divide-y" style={{ borderColor: "var(--p-border)" }}>
          {links.map((link) => <AgentLinkEditor key={link.id} link={link} busy={save.isPending || remove.isPending} onSave={(next) => saveFn({ data: next }).then(refresh)} onRemove={() => remove.mutate(link.id)} />)}
        </div>
      )}

      {agents.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="p-label">Agent assignments</div>
          {agents.map((agent: any) => (
            <div key={agent.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)] sm:items-center">
              <div className="min-w-0"><div className="p-body truncate">{agent.name}</div><div className="p-muted truncate">{agent.email}</div></div>
              <Select value={agent.assigned_agentlink_link_id ?? ""} onChange={(e) => assign.mutate({ agent_id: agent.id, link_id: e.target.value || null })}>
                <option value="">— not assigned —</option>
                {links.filter((link) => link.is_active).map((link) => <option key={link.id} value={link.id}>{link.label}</option>)}
              </Select>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AgentLinkEditor({ link, busy, onSave, onRemove }: { link: { id: string; label: string; url: string; is_active: boolean }; busy: boolean; onSave: (value: { id: string; label: string; url: string; is_active: boolean }) => Promise<unknown>; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(link.label);
  const [url, setUrl] = useState(link.url);
  if (editing) return (
    <div className="space-y-2 py-3">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="flex gap-2"><Button size="sm" variant="primary" disabled={busy || !label.trim() || !/^https:\/\/\S+$/i.test(url)} onClick={() => onSave({ ...link, label: label.trim(), url: url.trim() }).then(() => setEditing(false))}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0"><div className="p-body truncate">{link.label}</div><div className="p-muted truncate">{link.url}</div></div>
      <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => onSave({ ...link, is_active: !link.is_active })}>{link.is_active ? "Deactivate" : "Activate"}</Button><Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button><Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button></div>
    </div>
  );
}

/* 1:1 call link — leaders own this; applicants who can't attend an overview
   book with the nearest leader above their recruiter. */
function OneOnOneLinkPanel() {
  const getFn = useServerFn(getMySchedulingSettings);
  const saveFn = useServerFn(updateMySchedulingSettings);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me", "scheduling"], queryFn: () => getFn() });
  const save = useMutation({
    mutationFn: (v: { one_on_one_calendly_url: string }) => saveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "scheduling"] }),
  });

  const [url, setUrl] = useState("");
  useEffect(() => {
    if (q.data) setUrl(q.data.one_on_one_calendly_url ?? "");
  }, [q.data]);

  if (q.isLoading || !q.data?.can_edit_one_on_one) return null;

  const isValid = url === "" || CALENDLY_RE.test(url);
  const status = url === "" ? "Not set" : !isValid ? "Invalid" : "Set";

  return (
    <Panel title="1:1 call link">
      <p className="p-secondary mb-3">
        When an applicant in your downline can't attend a Monday overview, they'll be sent here to
        book a 1:1 call with you. If you leave this blank, they'll book with the next leader above
        you.
      </p>
      <Field label="Your 1:1 Calendly link">
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            className="flex-1"
            placeholder="https://calendly.com/your-name/30min"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            variant="primary"
            onClick={() => save.mutate({ one_on_one_calendly_url: url })}
            disabled={!isValid || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
        <Badge tone={status === "Set" ? "green" : status === "Invalid" ? "red" : "neutral"}>
          Status: {status}
        </Badge>
        {q.data?.one_on_one_calendly_updated_at && (
          <span className="p-muted">
            Updated {new Date(q.data.one_on_one_calendly_updated_at).toLocaleString()}
          </span>
        )}
        {url && isValid && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: "var(--p-gold)" }}
            className="hover:underline"
          >
            Test link →
          </a>
        )}
      </div>
      {!isValid && url !== "" && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--p-red)" }}>
          Must be a valid https://calendly.com/... URL.
        </p>
      )}
    </Panel>
  );
}

function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function TeamRecruitingLinksCard() {
  const getFn = useServerFn(getTeamRecruitingLinks);
  const q = useQuery({ queryKey: ["team", "recruiting-links"], queryFn: () => getFn() });
  const origin = useOrigin();
  const agents = q.data?.agents ?? [];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (q.isLoading || agents.length === 0) return null;

  async function copy(id: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* noop */
    }
  }

  return (
    <Panel title="Team recruiting links" description="Referral links for active agents on your team.">
      <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
        {agents.map((a) => {
          const link = a.recruiting_slug && origin ? `${origin}/?ref=${a.recruiting_slug}` : "";
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 py-3" style={{ borderColor: "var(--p-border)" }}>
              <div className="min-w-0">
                <div className="truncate p-body">{a.full_name || "Unnamed agent"}</div>
                <div className="truncate p-muted">{link || "No link"}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(a.id, link)} disabled={!link}>
                {copiedId === a.id ? "Copied!" : "Copy"}
              </Button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
