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
}): Promise<CoachResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI isn't configured.");
  const scriptText = input.scripts.map((s) => `### ${s.title}\n${s.content}`).join("\n\n").slice(0, 60000);
  const refText = input.references.map((r) => `### Model call: ${r.title}\n${r.transcript}`).join("\n\n").slice(0, 50000);
  const rubric = PILLARS.map((p) => `- ${p.key} (${p.label})${input.rubricNotes[p.key] ? `: a 10 looks like — ${input.rubricNotes[p.key]}` : ""}`).join("\n");

  const system = `You are the Vantage Financial call coach for final expense / veteran life insurance agents.
The GOLD STANDARD below (the official Vantage scripts and the manager's own model calls) is the single source of truth for how a call SHOULD go. Judge the agent ONLY against it — never against generic sales advice.
Score each pillar 1–10 (10 = matches the Gold Standard perfectly). If a section never happened on the call, score it 1–3 and say it was skipped.
Pillars:
${rubric}
Tonality: judge pace, confidence, energy and control as evidenced by wording, interruptions, filler and flow in the transcript.
For each pillar give: went_well (specific), to_fix (specific), better_line (an exact line from the Gold Standard script they should have said). Be direct and practical.
Also return sections: where each pillar starts in the call, using the [mm:ss] timestamps in the transcript, converted to milliseconds.`;

  const user = `GOLD STANDARD — SCRIPTS:\n${scriptText || "(none provided)"}\n\nGOLD STANDARD — MODEL CALLS:\n${refText || "(none provided)"}\n\nAGENT CALL (${input.callType}) TRANSCRIPT:\n${input.transcript.slice(0, 80000)}`;

  const pillarProps = Object.fromEntries(
    PILLARS.map((p) => [p.key, {
      type: "object",
      properties: { score: { type: "integer" }, went_well: { type: "string" }, to_fix: { type: "string" }, better_line: { type: "string" } },
      required: ["score", "went_well", "to_fix", "better_line"],
    }]),
  );
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{
        type: "function",
        function: {
          name: "submit_review",
          description: "Submit the scored call review.",
          parameters: {
            type: "object",
            properties: {
              pillars: { type: "object", properties: pillarProps, required: PILLARS.map((p) => p.key) },
              summary: { type: "string", description: "2-4 sentence overall assessment" },
              improvements: { type: "array", items: { type: "string" }, description: "Top 3 highest-impact fixes" },
              sections: { type: "array", items: { type: "object", properties: { pillar: { type: "string" }, start_ms: { type: "integer" } }, required: ["pillar", "start_ms"] } },
            },
            required: ["pillars", "summary", "improvements", "sections"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_review" } },
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Coach scoring failed [${res.status}]: ${body}`);
    if (res.status === 429) throw new Error("AI is busy right now. Try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are used up. Add credits in workspace settings.");
    throw new Error(`AI scoring failed (${res.status}).`);
  }
  const msg = JSON.parse(body)?.choices?.[0]?.message;
  const argStr = msg?.tool_calls?.[0]?.function?.arguments ?? msg?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = typeof argStr === "string" ? JSON.parse(argStr.replace(/^```(?:json)?/i, "").replace(/```$/, "")) : argStr;
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
