import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { StateCombobox } from "@/components/vantage/state-combobox";
import { getInvitationPublic, acceptInvitation } from "@/lib/invitations.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/portal-invite/$token")({
  head: () => ({
    meta: [{ title: "Set up your Vantage portal account" }, { name: "robots", content: "noindex" }],
  }),
  loader: async ({ params }) => {
    const invitation = await getInvitationPublic({ data: { token: params.token } });
    return { invitation };
  },
  component: InviteAcceptPage,
});

function InviteAcceptPage() {
  const { invitation } = Route.useLoaderData();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvitation);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState(invitation.phone ?? "");
  const [state, setState] = useState(invitation.state ?? "");
  const [licensed, setLicensed] = useState(!!invitation.licensed);
  const [npn, setNpn] = useState(invitation.npn ?? "");
  const [instagram, setInstagram] = useState(invitation.instagram_handle ?? "");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!invitation.found || invitation.status !== "pending") {
    const msg =
      invitation.status === "accepted"
        ? "This invitation has already been used."
        : invitation.status === "expired"
          ? "This invitation link has expired. Ask your recruiter to resend it."
          : invitation.status === "cancelled"
            ? "This invitation has been cancelled."
            : "This invitation link is invalid.";
    return (
      <PublicShell>
        <div className="mx-auto max-w-[640px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,56px)] leading-none">
            Invitation unavailable
          </h1>
          <p className="mt-4 text-vantage-muted">{msg}</p>
          <div className="mt-6">
            <Link to="/login" className="vantage-btn-ghost px-6 py-3.5">
              Go to login
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  async function onSubmit() {
    const errs: string[] = [];
    if (password.length < 8) errs.push("a password of at least 8 characters");
    if (password !== confirm) errs.push("matching passwords");
    if (!state) errs.push("your state");
    if (!npn.trim()) errs.push("your NPN");
    if (!terms) errs.push("acceptance of the portal terms");
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setBusy(true);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    try {
      const res = await accept({
        data: {
          token,
          password,
          phone: phone.trim(),
          state,
          licensed,
          npn: npn.trim(),
          instagram_handle: instagram.trim(),
          timezone,
          accept_terms: true,
        },
      });
      // Log the new user straight into the portal.
      await supabase.auth.signInWithPassword({ email: res.email, password });
      // New agents land on their onboarding checklist, not the dashboard.
      navigate({ to: "/portal/onboarding" });
    } catch (e) {
      setErrors([(e as Error).message || "Something went wrong. Please try again."]);
      setBusy(false);
    }
  }

  const fullName = [invitation.first_name, invitation.last_name].filter(Boolean).join(" ");

  return (
    <PublicShell>
      <div className="mx-auto max-w-[720px] px-6 pt-14 pb-24 md:px-8">
        <div className="text-center">
          <div className="vantage-eyebrow-pill mb-5 inline-flex">Vantage Portal</div>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] leading-none">
            Set up your account
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-relaxed text-vantage-muted">
            Welcome{fullName ? `, ${fullName}` : ""}. Create your password and confirm your details
            to access your Vantage portal, CRM, pipeline, and recruiting link.
          </p>
          <p className="mt-2 text-[13px] text-vantage-faint">
            Signing up as <span className="text-vantage-fog capitalize">{invitation.role}</span> ·{" "}
            {invitation.email}
          </p>
        </div>

        <div className="vantage-card mt-10 grid gap-4 p-6 md:p-10">
          <div className="grid gap-3 rounded-[12px] border border-white/8 bg-white/[0.02] p-4 md:grid-cols-2">
            <ReadOnly label="Name" value={fullName || "—"} />
            <ReadOnly label="Email" value={invitation.email ?? "—"} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <Field label="Password *">
              <input
                type="password"
                className="vantage-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirm password *">
              <input
                type="password"
                className="vantage-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Phone">
            <input
              type="tel"
              className="vantage-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="State *">
            <StateCombobox value={state} onChange={setState} />
          </Field>
          <Field label="NPN *">
            <input
              className="vantage-input"
              placeholder="Your National Producer Number"
              value={npn}
              onChange={(e) => {
                setNpn(e.target.value);
                if (!licensed) setLicensed(true);
              }}
            />
          </Field>

          <Field label="Instagram handle">
            <input
              className="vantage-input"
              placeholder="@yourhandle"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
          </Field>
          <label className="flex items-start gap-3 text-[14px] leading-relaxed text-vantage-fog">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-1 h-4 w-4 accent-vantage-gold"
            />
            I accept the Vantage portal terms and confirm my information is accurate.
          </label>

          {errors.length > 0 && (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3.5 text-[13.5px] text-red-200">
              Please provide {errors.join(", ")}.
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={busy}
            className="vantage-btn-primary mt-2 w-full px-6 py-4 text-[16px] disabled:opacity-60"
          >
            {busy ? "Creating your account…" : "Create account & enter portal →"}
          </button>
        </div>
      </div>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-vantage-faint">
        {label}
      </span>
      <span className="block text-[14.5px] text-vantage-fog">{value}</span>
    </div>
  );
}

