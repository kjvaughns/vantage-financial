import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { StateCombobox } from "@/components/vantage/state-combobox";
import { getAgentJoinContext, registerAgentViaLink } from "@/lib/agent-join.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/join/$slug")({
  head: () => ({
    meta: [
      { title: "Join Vantage Financial | Agent registration" },
      {
        name: "description",
        content:
          "Register your Vantage Financial agent portal account and start onboarding in minutes.",
      },
      { property: "og:title", content: "Join Vantage Financial" },
      {
        property: "og:description",
        content: "Create your Vantage agent account and begin onboarding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => ({
    ctx: await getAgentJoinContext({ data: { slug: params.slug } }),
  }),
  errorComponent: () => (
    <PublicShell>
      <div className="mx-auto max-w-[640px] px-6 pt-24 pb-24 text-center md:px-8">
        <h1 className="font-display text-[clamp(36px,6vw,56px)] leading-none">
          Something went wrong
        </h1>
        <p className="mt-4 text-vantage-muted">Please refresh, or ask your recruiter for a new link.</p>
      </div>
    </PublicShell>
  ),
  notFoundComponent: () => (
    <PublicShell>
      <div className="mx-auto max-w-[640px] px-6 pt-24 pb-24 text-center md:px-8">
        <h1 className="font-display text-[clamp(36px,6vw,56px)] leading-none">Link not found</h1>
      </div>
    </PublicShell>
  ),
  component: JoinPage,
});

function JoinPage() {
  const { ctx } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const register = useServerFn(registerAgentViaLink);

  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    npn: "",
    instagram_handle: "",
    password: "",
    confirm: "",
  });
  const [state, setState] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  if (!ctx.found) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[640px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,56px)] leading-none">
            Invite link unavailable
          </h1>
          <p className="mt-4 text-vantage-muted">
            This registration link is invalid or no longer active. Ask your recruiter for a new one.
          </p>
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
    if (!f.first_name.trim()) errs.push("your first name");
    if (!f.last_name.trim()) errs.push("your last name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errs.push("a valid email");
    if (f.phone.replace(/\D/g, "").length < 7) errs.push("your phone number");
    if (!state) errs.push("your state");
    if (!f.npn.trim()) errs.push("your NPN");
    if (f.password.length < 8) errs.push("a password of at least 8 characters");
    if (f.password !== f.confirm) errs.push("matching passwords");
    if (!terms) errs.push("acceptance of the portal terms");
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      const res = await register({
        data: {
          slug,
          first_name: f.first_name.trim(),
          last_name: f.last_name.trim(),
          email: f.email.trim(),
          phone: f.phone.trim(),
          state,
          npn: f.npn.trim(),
          instagram_handle: f.instagram_handle.trim(),
          password: f.password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          accept_terms: true,
        },
      });
      await supabase.auth.signInWithPassword({ email: res.email, password: f.password });
      navigate({ to: "/portal/onboarding" });
    } catch (e) {
      setErrors([(e as Error).message || "Something went wrong. Please try again."]);
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[720px] px-6 pt-14 pb-24 md:px-8">
        <div className="text-center">
          <div className="vantage-eyebrow-pill mb-5 inline-flex">Vantage Portal</div>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] leading-none">
            Register as an agent
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-relaxed text-vantage-muted">
            {ctx.recruiter_name
              ? `${ctx.recruiter_name} invited you to Vantage Financial.`
              : "You've been invited to Vantage Financial."}{" "}
            Create your account and you'll drop straight into onboarding.
          </p>
          {ctx.team_name && (
            <p className="mt-2 text-[13px] text-vantage-faint">Team · {ctx.team_name}</p>
          )}
        </div>

        <div className="vantage-card mt-10 grid gap-4 p-6 md:p-10">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <Field label="First name *">
              <input
                className="vantage-input"
                value={f.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Last name *">
              <input
                className="vantage-input"
                value={f.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Email *">
            <input
              type="email"
              className="vantage-input"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone *">
            <input
              type="tel"
              className="vantage-input"
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="State *">
            <StateCombobox value={state} onChange={setState} />
          </Field>
          <Field label="NPN *">
            <input
              className="vantage-input"
              placeholder="Your National Producer Number"
              value={f.npn}
              onChange={(e) => set("npn", e.target.value)}
            />
          </Field>
          <Field label="Instagram handle">
            <input
              className="vantage-input"
              placeholder="@yourhandle"
              value={f.instagram_handle}
              onChange={(e) => set("instagram_handle", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <Field label="Password *">
              <input
                type="password"
                className="vantage-input"
                value={f.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </Field>
            <Field label="Confirm password *">
              <input
                type="password"
                className="vantage-input"
                value={f.confirm}
                onChange={(e) => set("confirm", e.target.value)}
              />
            </Field>
          </div>

          <label className="flex items-start gap-3 text-[14px] leading-relaxed text-vantage-fog">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-1 h-4 w-4 accent-vantage-gold"
            />
            I accept the Vantage portal terms and consent to be contacted about my onboarding.
          </label>

          {errors.length > 0 && (
            <div className="rounded-[12px] border border-red-500/40 bg-red-500/10 px-4 py-3 text-[14px] text-red-200">
              Please provide {errors.join(", ")}.
            </div>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="vantage-btn-primary mt-2 px-6 py-3.5 disabled:opacity-60"
          >
            {busy ? "Creating your account…" : "Create account & start onboarding"}
          </button>
          <p className="text-center text-[13px] text-vantage-faint">
            Already have an account?{" "}
            <Link to="/login" className="text-vantage-gold underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] tracking-[0.08em] text-vantage-faint uppercase">{label}</span>
      {children}
    </label>
  );
}
