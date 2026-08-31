import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Vantage Financial" },
      { name: "description", content: "Set a new password for your Vantage Financial agent account." },
      { property: "og:title", content: "Choose a new password — Vantage Financial" },
      { property: "og:description", content: "Set a new password for your Vantage Financial agent account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        done = true;
        setReady("ok");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        done = true;
        setReady("ok");
      }
    });

    // Give Supabase a moment to parse the recovery link from the URL.
    const timer = setTimeout(() => {
      if (!done) setReady((prev) => (prev === "ok" ? prev : "invalid"));
    }, 2500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/portal" });
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[520px] px-6 pt-16 pb-24 md:px-8">
        <div className="vantage-card p-8 md:p-10">
          <div className="vantage-kicker mb-2">Agent portal</div>
          <h1 className="font-display text-[clamp(32px,5vw,44px)] leading-none">
            Choose a new password
          </h1>

          {ready === "checking" && (
            <p className="mt-4 text-[15px] leading-relaxed text-vantage-muted">
              Checking your reset link…
            </p>
          )}

          {ready === "invalid" && (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-vantage-muted">
                This reset link is invalid, expired, or has already been used. Request a fresh one and
                we'll email you a new link.
              </p>
              <Link
                to="/login"
                search={{ forgot: true }}
                className="vantage-btn-primary mt-6 inline-block px-6 py-4 text-[15px]"
              >
                Request a new link →
              </Link>
            </>
          )}

          {ready === "ok" && (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-vantage-muted">
                Pick a password you'll remember — at least 8 characters.
              </p>
              <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                <label>
                  <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">
                    New password
                  </span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    className="vantage-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">
                    Confirm password
                  </span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    className="vantage-input"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                {error && (
                  <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3 text-[13.5px] text-red-200">
                    {error}
                  </div>
                )}
                <button
                  disabled={busy}
                  className="vantage-btn-primary mt-2 w-full px-6 py-4 text-[15px] disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save password →"}
                </button>
              </form>
            </>
          )}

          <div className="mt-5 flex items-center justify-between text-[13px] text-vantage-faint">
            <Link to="/login" className="hover:text-vantage-gold">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
