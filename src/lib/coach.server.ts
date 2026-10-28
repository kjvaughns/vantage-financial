/** Server-only Call Coach helpers: Google Docs script import and AI scoring
 *  against the stored Gold Standard (scripts + reference call transcripts). */
import { PILLARS, normalizePillars, type PillarScores } from "@/lib/coach-scoring";

const DOCS_GATEWAY = "https://connector-gateway.lovable.dev/google_docs/v1";

export async function fetchGoogleDocText(docId: string): Promise<{ title: string; text: string }> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_DOCS_API_KEY"];
  if (!lovable || !conn) throw new Error("Google Docs isn't connected yet.");
  const res = await fetch(`${DOCS_GATEWAY}/documents/${encodeURIComponent(docId)}?includeTabsContent=true`, {
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Docs fetch failed [${res.status}]: ${body}`);
    throw new Error(`Couldn't read that Google Doc (${res.status}). Make sure it's in the connected Google account.`);
  }
  const doc = (await res.json()) as any;
  const bodies: any[] = [];
  const walkTabs = (tabs: any[]) => {
    for (const t of tabs ?? []) {
      if (t.documentTab?.body) bodies.push(t.documentTab.body);
      walkTabs(t.childTabs ?? []);
    }
  };
  if (Array.isArray(doc.tabs) && doc.tabs.length) walkTabs(doc.tabs);
  else if (doc.body) bodies.push(doc.body);
  const lines: string[] = [];
  const walk = (content: any[]) => {
    for (const el of content ?? []) {
      if (el.paragraph) {
        const t = (el.paragraph.elements ?? []).map((e: any) => e.textRun?.content ?? "").join("").replace(/\n$/, "");
        const style = el.paragraph.paragraphStyle?.namedStyleType ?? "";
        if (t.trim()) lines.push(style.startsWith("HEADING") || style === "TITLE" ? `\n## ${t.trim()}` : t);
      } else if (el.table) {
        for (const row of el.table.tableRows ?? []) for (const cell of row.tableCells ?? []) walk(cell.content);
      }
    }
  };
  for (const b of bodies) walk(b.content);
  return { title: String(doc.title ?? "Script"), text: lines.join("\n").trim() };
}

export type CoachResult = {
  pillars: PillarScores;
  summary: string;
  improvements: string[];
  sections: { pillar: string; start_ms: number }[];
};

export async function scoreCall(input: {
  transcript: string;
  scripts: { title: string; content: string }[];
  references: { title: string; transcript: string }[];
  rubricNotes: Record<string, string>;
  callType: string;
  /** Sections this homework is meant to cover; others are optional. */
  expectedPillars?: string[];
}): Promise<CoachResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI isn't configured.");
  const scriptText = input.scripts.map((s) => `### ${s.title}\n${s.content}`).join("\n\n").slice(0, 60000);
  const refText = input.references.map((r) => `### Model call: ${r.title}\n${r.transcript}`).join("\n\n").slice(0, 50000);
  const rubric = PILLARS.map((p) => `- ${p.key} (${p.label})${input.rubricNotes[p.key] ? `: a 10 looks like — ${input.rubricNotes[p.key]}` : ""}`).join("\n");

  const system = `You are the Vantage Financial call coach for final expense / veteran life insurance agents.
The GOLD STANDARD below (the official Vantage scripts and the manager's own model calls) is the single source of truth for how a call SHOULD go. Judge the agent ONLY against it — never against generic sales advice.
Think in two steps.
STEP 1 — MAP THE CALL: read the whole transcript and decide which script sections the agent actually performed. Roleplays often cover only part of the script (e.g. only medical + bank). For each pillar set status:
- "performed": the agent clearly ran this section.
- "partial": they started it but cut it short.
- "not_attempted": it never happened on this recording (including when the recording simply starts later or ends earlier).
Put a short quote or timestamp in "evidence" for your decision. Never assume a section happened off-recording.
STEP 2 — GRADE ONLY WHAT HAPPENED: score performed/partial pillars 1–10 (10 = matches the Gold Standard perfectly), comparing each ONLY to the matching section of the Gold Standard. For not_attempted pillars set score to 0 and leave went_well/to_fix/better_line empty — do NOT penalize them or mention them in improvements. Rapport and tonality are judged across whatever portion was performed.
The summary and top improvements must only cover sections that were performed.${input.expectedPillars?.length ? `
This is training homework that is expected to cover: ${input.expectedPillars.join(", ")}. If an expected section is not_attempted, add one short note at the end of the summary: "Missing from today's homework: …". Sections outside this list are optional.` : ""}
Pillars:
${rubric}
Tonality: judge pace, confidence, energy and control as evidenced by wording, interruptions, filler and flow in the transcript.
For each pillar give: went_well (specific), to_fix (specific), better_line (an exact line from the Gold Standard script they should have said). Be direct and practical.
Also return sections: where each pillar starts in the call, using the [mm:ss] timestamps in the transcript, converted to milliseconds.`;

  const user = `GOLD STANDARD — SCRIPTS:\n${scriptText || "(none provided)"}\n\nGOLD STANDARD — MODEL CALLS:\n${refText || "(none provided)"}\n\nAGENT CALL (${input.callType}) TRANSCRIPT:\n${input.transcript.slice(0, 80000)}`;

  const pillarProps = Object.fromEntries(
    PILLARS.map((p) => [p.key, {
      type: "object",
      additionalProperties: false,
      properties: { status: { type: "string", enum: ["performed", "partial", "not_attempted"] }, evidence: { type: "string" }, score: { type: "integer" }, went_well: { type: "string" }, to_fix: { type: "string" }, better_line: { type: "string" } },
      required: ["status", "evidence", "score", "went_well", "to_fix", "better_line"],
    }]),
  );
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      pillars: { type: "object", additionalProperties: false, properties: pillarProps, required: PILLARS.map((p) => p.key) },
      summary: { type: "string" },
      improvements: { type: "array", items: { type: "string" } },
      sections: { type: "array", items: { type: "object", additionalProperties: false, properties: { pillar: { type: "string" }, start_ms: { type: "integer" } }, required: ["pillar", "start_ms"] } },
    },
    required: ["pillars", "summary", "improvements", "sections"],
  };
  const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
  let text = "";
  try {
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions: system,
      input: user,
      text: { format: { type: "json_schema", name: "call_review", schema, strict: true } },
    } as any);
    for (const item of (res as any).output ?? []) {
      if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") text += c.text;
    }
  } catch (e) {
    if (e instanceof GatewayError) {
      console.error("Coach scoring failed", e.code, e.httpStatus, e.ids);
      if (e.httpStatus === 429) throw new Error("AI is busy right now. Try again in a minute.");
      if (e.httpStatus === 402) throw new Error("AI credits are used up. Add credits in workspace settings.");
      throw new Error(`AI scoring failed (${e.httpStatus ?? e.code}).`);
    }
    throw e;
  }
  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI returned an unreadable review. Try again.");
  }
  return {
    pillars: normalizePillars(parsed.pillars),
    summary: String(parsed.summary ?? "").slice(0, 3000),
    improvements: (Array.isArray(parsed.improvements) ? parsed.improvements : []).slice(0, 3).map((s: unknown) => String(s).slice(0, 600)),
    sections: (Array.isArray(parsed.sections) ? parsed.sections : [])
      .filter((s: any) => s && typeof s.pillar === "string")
      .map((s: any) => ({ pillar: String(s.pillar), start_ms: Math.max(0, Number(s.start_ms) || 0) })),
  };
}

export function timedTranscript(segments: { start: number; text: string; speaker?: string | null }[]): string {
  return segments
    .map((s) => {
      const t = Math.floor(s.start / 1000);
      return `[${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}`;
    })
    .join("\n");
}
