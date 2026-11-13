import { DIALER_SHEET_URL } from "./shared";

export type DigestRow = {
  agent_name: string; last_change: string; lead_types: string[]; states: string[];
  baseline_lead_types?: string[] | null; baseline_states?: string[] | null;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const diff = (now: string[], before: string[]) => ({
  added: now.filter((x) => !before.includes(x)), removed: before.filter((x) => !now.includes(x)),
});
const pill = (t: string, kind: "add" | "remove" | "plain") => {
  const st = kind === "add" ? "background:#E8F5E9;color:#1B5E20" : kind === "remove" ? "background:#FDECEA;color:#B71C1C;text-decoration:line-through" : "background:#F6F1E3;color:#5C4A16";
  return `<span style="display:inline-block;${st};padding:3px 8px;border-radius:4px;margin:2px 4px 2px 0;font-size:13px;font-weight:bold">${kind === "add" ? "+ " : kind === "remove" ? "− " : ""}${esc(t)}</span>`;
};
const line = (label: string, body: string) =>
  `<tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;vertical-align:top;width:110px">${label}</td><td style="padding:4px 0">${body}</td></tr>`;
const card = (title: string, inner: string) =>
  `<div style="border:1px solid #E5DCC3;border-radius:8px;padding:14px 16px;margin:0 0 12px"><div style="font-size:16px;font-weight:bold;margin:0 0 8px">${esc(title)}</div><table style="border-collapse:collapse">${inner}</table></div>`;
const heading = (t: string, n: number) =>
  `<h3 style="margin:24px 0 10px;font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#9a7a2c;border-bottom:2px solid #C9A84C;padding-bottom:6px">${t} (${n})</h3>`;

export function buildDigestHtml(label: string, data: DigestRow[]) {
  const news = data.filter((r) => r.last_change === "new" || !r.baseline_states);
  const updates = data.filter((r) => !news.includes(r));
  const newHtml = news.map((r) => card(r.agent_name,
    line("Lead types", r.lead_types.map((t) => pill(t, "plain")).join("") || "—") +
    line("States", r.states.map((t) => pill(t, "plain")).join("") || "—"))).join("");
  const updHtml = updates.map((r) => {
    const lt = diff(r.lead_types, r.baseline_lead_types ?? []);
    const st = diff(r.states, r.baseline_states ?? []);
    let inner = "";
    if (lt.added.length) inner += line("Add lead types", lt.added.map((t) => pill(t, "add")).join(""));
    if (lt.removed.length) inner += line("Remove lead types", lt.removed.map((t) => pill(t, "remove")).join(""));
    if (st.added.length) inner += line("Add states", st.added.map((t) => pill(t, "add")).join(""));
    if (st.removed.length) inner += line("Remove states", st.removed.map((t) => pill(t, "remove")).join(""));
    if (!inner) inner = line("Changes", "No net change");
    inner += line("Now has", `<span style="font-size:13px;color:#444">${esc(r.lead_types.join(", "))} · ${esc(r.states.join(", "))}</span>`);
    return card(r.agent_name, inner);
  }).join("");
  return `<div style="font-family:Arial,sans-serif;background:#ffffff;color:#111;padding:24px;max-width:640px">
    <h2 style="margin:0 0 4px">Dialer support requests</h2>
    <p style="margin:0;color:#666">${esc(label)} · ${news.length} new login${news.length === 1 ? "" : "s"}, ${updates.length} update${updates.length === 1 ? "" : "s"}</p>
    ${news.length ? heading("New dialer login requests", news.length) + newHtml : ""}
    ${updates.length ? heading("Dialer updates", updates.length) + updHtml : ""}
    <p style="margin:24px 0 8px"><a href="${DIALER_SHEET_URL}" style="display:inline-block;background:#C9A84C;color:#000;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">Open the dialer sheet</a></p>
    <p style="font-size:13px;color:#555">Add logins in the sheet — they appear in the portal automatically.<br><a href="${DIALER_SHEET_URL}" style="color:#9a7a2c">${DIALER_SHEET_URL}</a></p></div>`;
}
