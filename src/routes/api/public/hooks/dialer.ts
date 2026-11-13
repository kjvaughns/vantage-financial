import { createFileRoute } from "@tanstack/react-router";
import { DIALER_SHEET_URL, DIALER_SUPPORT_EMAIL, previousCentralDay } from "@/lib/dialer/shared";

/**
 * Dialer support jobs, called by pg_cron with the publishable key in `apikey`
 * (same scheme as email-dispatch):
 *   {"job":"sync"}   every 10 min — pull dialer logins from the Google Sheet
 *   {"job":"digest"} daily 8 AM CT — email support yesterday's requests
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function runDigest(admin: any) {
  // Scheduled at both 13:00 and 14:00 UTC; only the run that lands at 8 AM Central sends.
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour !== 8) return { sent: false, skipped: "not 8 AM Central" };
  const { start, end, label } = previousCentralDay(new Date());
  const { data, error } = await admin.from("dialer_requests")
    .select("agent_name, lead_types, states, last_change, changed_at")
    .gte("changed_at", start.toISOString()).lt("changed_at", end.toISOString())
    .neq("last_change", "admin").neq("status", "inactive")
    .order("changed_at");
  if (error) throw error;
  if (!data?.length) return { sent: false, count: 0 };
  const rows = data.map((r: any) => `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee">${esc(r.agent_name)}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${r.last_change === "new" ? "New" : "Update"}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${esc(r.lead_types.join(", "))}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${esc(r.states.join(", "))}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;background:#ffffff;color:#111;padding:20px">
    <h2 style="margin:0 0 8px">Dialer support requests — ${label}</h2>
    <p>${data.length} new or updated request${data.length === 1 ? "" : "s"} from Vantage agents yesterday.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr style="text-align:left"><th style="padding:8px">Agent</th><th style="padding:8px">Type</th><th style="padding:8px">Lead types</th><th style="padding:8px">States</th></tr>
      ${rows}</table>
    <p style="margin-top:16px"><a href="${DIALER_SHEET_URL}" style="color:#9a7a2c">Open the dialer sheet</a> to add logins — they appear in the portal automatically.</p></div>`;
  const { sendRawEmail } = await import("@/lib/email-templates/send-email");
  const res = await sendRawEmail(DIALER_SUPPORT_EMAIL, `Dialer requests for ${label} (${data.length})`, html, {
    idempotencyKey: `dialer-digest-${label}`,
  });
  return { sent: res.sent, count: data.length };
}

export const Route = createFileRoute("/api/public/hooks/dialer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!key || !expected || key !== expected) return Response.json({ error: "Unauthorized" }, { status: 401 });
        let job = "sync";
        try { const b = (await request.json()) as { job?: string }; if (b?.job === "digest") job = "digest"; } catch { /* default */ }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          if (job === "digest") return Response.json({ ok: true, job, ...(await runDigest(supabaseAdmin)) });
          const { syncFromSheet } = await import("@/lib/dialer/sheets.server");
          return Response.json({ ok: true, job, ...(await syncFromSheet(supabaseAdmin)) });
        } catch (e) {
          console.error("[dialer-hook] failed", e);
          return Response.json({ error: "Job failed" }, { status: 500 });
        }
      },
    },
  },
});
