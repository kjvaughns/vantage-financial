import { DIALER_SHEET_ID } from "./shared";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovable || !conn) throw new Error("Google Sheets connection is not configured");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn, "Content-Type": "application/json" };
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${DIALER_SHEET_ID}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[dialer] Sheets request failed [${res.status}]: ${body}`);
    throw new Error(`Google Sheets request failed [${res.status}]`);
  }
  return res.json();
}

export type SheetRow = { row: number; name: string; leadTypes: string; states: string; username: string; password: string };

export async function readSheet(): Promise<SheetRow[]> {
  const json = await call(`/values/Sheet1!A2:E2000`);
  const values: string[][] = json.values ?? [];
  return values.map((v, i) => ({
    row: i + 2,
    name: (v[0] ?? "").trim(),
    leadTypes: v[1] ?? "",
    states: v[2] ?? "",
    username: (v[3] ?? "").trim(),
    password: v[4] ?? "",
  }));
}

export async function readRow(row: number): Promise<SheetRow | null> {
  const json = await call(`/values/Sheet1!A${row}:E${row}`);
  const v: string[] = json.values?.[0] ?? [];
  if (!v.length) return null;
  return { row, name: (v[0] ?? "").trim(), leadTypes: v[1] ?? "", states: v[2] ?? "", username: (v[3] ?? "").trim(), password: v[4] ?? "" };
}

export async function writeRequestRow(row: number, name: string, leadTypes: string, states: string) {
  await call(`/values/Sheet1!A${row}:C${row}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [[name, leadTypes, states]] }),
  });
}

export async function appendRequestRow(name: string, leadTypes: string, states: string): Promise<number> {
  const json = await call(`/values/Sheet1!A:C:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [[name, leadTypes, states]] }),
  });
  const range: string = json.updates?.updatedRange ?? "";
  const m = range.match(/!A(\d+)/);
  if (!m) throw new Error("Could not determine new sheet row");
  return Number(m[1]);
}

/** Find the agent's row: trust stored row if the name still matches, else search by name. */
export function locateRow(rows: SheetRow[], storedRow: number | null, name: string): SheetRow | undefined {
  const n = name.trim().toLowerCase();
  const byStored = storedRow ? rows.find((r) => r.row === storedRow) : undefined;
  if (byStored && byStored.name.toLowerCase() === n) return byStored;
  return rows.find((r) => r.name.toLowerCase() === n);
}

/** Pull logins from the sheet into the database (no passwords stored). */
export async function syncFromSheet(admin: any) {
  const [rows, { data: reqs, error }] = await Promise.all([
    readSheet(),
    admin.from("dialer_requests").select("id, agent_name, sheet_row, dialer_username, has_password, status"),
  ]);
  if (error) throw error;
  let updated = 0;
  for (const r of reqs ?? []) {
    const hit = locateRow(rows, r.sheet_row, r.agent_name);
    const username = hit?.username || null;
    const hasPw = !!hit?.password;
    const status = username ? "active" : "requested";
    const sheetRow = hit?.row ?? r.sheet_row;
    if (username !== r.dialer_username || hasPw !== r.has_password || status !== r.status || sheetRow !== r.sheet_row) {
      await admin.from("dialer_requests").update({
        dialer_username: username, has_password: hasPw, status, sheet_row: sheetRow,
        last_synced_at: new Date().toISOString(),
      }).eq("id", r.id);
      updated++;
    }
  }
  return { updated, total: reqs?.length ?? 0 };
}
