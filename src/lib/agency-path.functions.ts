import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const PATH_QUESTIONS = [
  { id: "role", q: "Which best describes you today?", options: ["New to insurance / not licensed", "Licensed solo producer", "Team leader with downlines", "Agency owner with my own brand"] },
  { id: "team", q: "How many agents currently write under you?", options: ["None", "1–3", "4–10", "11–25", "25+"] },
  { id: "production", q: "Current monthly team production?", options: ["Under $10K", "$10K–$25K", "$25K–$50K", "$50K–$100K", "$100K+"] },
  { id: "pain", q: "What's holding you back most right now?", options: ["Lead cost and consistency", "Training and retaining agents", "Tech, dialer, and systems", "Carrier contracts and backend", "Leadership and mentorship", "Learning to sell myself"] },
  { id: "brand", q: "How do you feel about branding?", options: ["I want to grow under an established brand", "I want to keep or build my own agency brand", "Not sure yet"] },
  { id: "goal", q: "Where do you want to be in 12 months?", options: ["Consistent personal income", "A bigger, productive team", "Running my own IMO with multiple agencies"] },
] as const;

const answersSchema = z.record(z.string(), z.string().max(200));
export type PathResult = {
  recommendation: "agent" | "builder" | "owner";
  headline: string;
  reasons: string[];
  pain_points: string[];
};

function fallback(a: Record<string, string>): PathResult {
  const team = a.team ?? "None";
  const owner = a.role?.startsWith("Agency owner") || a.brand?.includes("own agency") || a.goal?.includes("IMO");
  const rec: PathResult["recommendation"] = team === "None" ? "agent" : owner && team !== "1–3" ? "owner" : "builder";
  return {
    recommendation: rec,
    headline: rec === "agent" ? "Start as an individual agent" : rec === "builder" ? "Build your team under Vantage" : "Power your agency with InsuraCloud",
    reasons: [rec === "agent" ? "Builder and Owner paths require an existing team." : `You already lead ${team} agents.`],
    pain_points: [a.pain].filter(Boolean) as string[],
  };
}

export const recommendAgencyPath = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ answers: answersSchema }).parse(d))
  .handler(async ({ data }): Promise<PathResult> => {
    const key = process.env.LOVABLE_API_KEY;
    const fb = fallback(data.answers);
    if (!key) return fb;
    const summary = PATH_QUESTIONS.map((q) => `${q.q} ${data.answers[q.id] ?? "(skipped)"}`).join("\n");
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          stream: true,
          store: false,
          reasoning: { effort: "low" },
          instructions:
            "You place life-insurance professionals into one of three Vantage Financial paths. agent: solo or unlicensed people with no downlines (join as an individual agent). builder: has at least one downline, wants to grow under the Vantage brand with covered leads forever, AI dialer, FEX/Veteran/Mortgage Protection leads, training, culture and leadership. owner: established agency with its own brand, training and recruiting already in place, wants InsuraCloud infrastructure (one-link contracting, 20+ carriers, leaderboards, finance and book tracking, growing into an IMO). Never recommend builder or owner for someone with no downlines. Write a short headline (under 10 words), 2-3 reasons addressed to the person (each under 25 words), and 1-3 concise pain points.",
          input: summary,
          text: {
            format: {
              type: "json_schema", name: "path", strict: true,
              schema: {
                type: "object", additionalProperties: false,
                required: ["recommendation", "headline", "reasons", "pain_points"],
                properties: {
                  recommendation: { type: "string", enum: ["agent", "builder", "owner"] },
                  headline: { type: "string" },
                  reasons: { type: "array", items: { type: "string" } },
                  pain_points: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        }),
      });
      if (!res.ok || !res.body) return fb;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", out = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(l.slice(5).trim());
            if (ev.type === "response.output_text.delta") out += ev.delta;
          } catch { /* ignore */ }
        }
      }
      const parsed = JSON.parse(out) as PathResult;
      if (data.answers.team === "None") parsed.recommendation = "agent";
      return parsed;
    } catch {
      return fb;
    }
  });
