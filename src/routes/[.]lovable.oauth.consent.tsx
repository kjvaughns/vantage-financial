import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/vantage/brand";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

// The managed auth API validates the request Origin against the OAuth Site URL and
// rejects every other origin ("unauthorized request origin"), so the consent page
// must always run on the published custom-domain origin even if the link was opened
// on a preview or other app origin.
const CANONICAL_ORIGIN = "https://vantage-financial.net";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [{ title: "Authorize access — Vantage Financial" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    const current = new URL(location.href, CANONICAL_ORIGIN);
    if (current.origin !== CANONICAL_ORIGIN) {
      throw redirect({ href: CANONICAL_ORIGIN + current.pathname + current.search });
    }
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } as never });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => {
    const message = error instanceof Error ? error.message : String(error);
    const originBlocked = /unauthorized request origin/i.test(message);
    return (
      <PublicShell>
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="text-2xl">Couldn't load this request</h1>
          <p className="mt-3 opacity-70">
            {originBlocked
              ? "This authorization link must be opened on the published Vantage site. Please reopen the connection link from https://vantage-financial.net."
              : message}
          </p>
        </main>
      </PublicShell>
    );
  },
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? details?.client?.client_name ?? "An app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect was returned. Please try connecting again."); return; }
    window.location.href = target;
  }

  return (
    <PublicShell>
      <main className="mx-auto max-w-md px-6 py-24">
        <h1 className="text-3xl">Connect {name}</h1>
        <p className="mt-4 opacity-80">
          {name} wants to access your Vantage account. It will be able to view and update applicants,
          change stages, add notes and see your team — with the same permissions you have.
        </p>
        {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
        <div className="mt-8 flex gap-3">
          <button disabled={busy} onClick={() => decide(true)}
            className="rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground disabled:opacity-50">
            Approve
          </button>
          <button disabled={busy} onClick={() => decide(false)}
            className="rounded-md border border-border px-5 py-2.5 disabled:opacity-50">
            Deny
          </button>
        </div>
      </main>
    </PublicShell>
  );
}
