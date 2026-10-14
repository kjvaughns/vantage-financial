import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRecruitingLink } from "@/lib/portal.functions";
import { Panel, Button, Badge } from "@/components/portal/ui";

function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function useRecruitingLink() {
  const getFn = useServerFn(getMyRecruitingLink);
  const q = useQuery({ queryKey: ["me", "recruiting-link"], queryFn: () => getFn() });
  const origin = useOrigin();
  const slug = q.data?.recruiting_slug ?? null;
  const link = slug && origin ? `${origin}/?ref=${slug}` : "";
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  return { q, slug, link, canShare };
}

async function copyText(text: string, done: () => void) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    /* clipboard blocked — user can still select the text */
  }
}

async function shareLink(link: string) {
  if (!link) return;
  try {
    await navigator.share({ title: "Apply to Vantage Financial", url: link });
  } catch {
    /* share cancelled/unsupported */
  }
}

/**
 * The agent's personal recruiting link, rendered as a compact single-row
 * utility panel. Reuses getMyRecruitingLink — no new data logic.
 */
export function RecruitingLinkCard({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { q, slug, link, canShare } = useRecruitingLink();
  const [copied, setCopied] = useState(false);
  const copy = () => copyText(link, () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  });

  return (
    <Panel padded={false} bodyClassName="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
        <span className="p-label shrink-0 uppercase tracking-[0.06em]">Your link</span>

        {q.isLoading ? (
          <span className="p-secondary">Loading…</span>
        ) : !slug ? (
          <span className="p-secondary">Not set up yet — ask an administrator.</span>
        ) : (
          <>
            <div
              className="min-w-[160px] flex-1 truncate rounded-[8px] border px-2.5 py-1.5 font-mono text-[12.5px]"
              style={{
                borderColor: "var(--p-border)",
                background: "var(--p-raised)",
                color: "var(--p-text-2)",
              }}
              onClick={(e) => {
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                window.getSelection()?.removeAllRanges();
                window.getSelection()?.addRange(range);
              }}
            >
              {link || "…"}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button size="sm" variant="primary" onClick={copy} disabled={!link}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <a
                href={link || "#"}
                target="_blank"
                rel="noreferrer noopener"
                className="p-focus inline-flex h-8 items-center justify-center rounded-[10px] border px-2.5 text-[13px] font-semibold transition hover:brightness-[1.08]"
                style={{
                  background: "var(--p-raised)",
                  borderColor: "var(--p-border)",
                  color: "var(--p-text)",
                }}
              >
                Open
              </a>
              {canShare && (
                <Button size="sm" variant="ghost" onClick={() => shareLink(link)}>
                  Share
                </Button>
              )}
              <Badge tone="gold">{q.data?.applicant_count ?? 0} applicants</Badge>
              {!q.data?.can_receive_applicants && (
                <Badge tone="amber">Paused</Badge>
              )}
            </div>
          </>
        )}
      </div>
      {slug && link && (
        <div className="flex flex-wrap items-center gap-2.5 px-3 pb-2.5">
          <span className="p-label shrink-0 uppercase tracking-[0.06em]">Agency link</span>
          <span className="min-w-[160px] flex-1 truncate font-mono text-[12.5px]" style={{ color: "var(--p-text-2)" }}>
            {link.replace("/?ref=", "/agency?ref=")}
          </span>
          <Button size="sm" variant="ghost" onClick={() => copyText(link.replace("/?ref=", "/agency?ref="), () => {})}>
            Copy
          </Button>
        </div>
      )}
    </Panel>
  );
}
