import { Mail, MessageSquare, ContactRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button, btnClass } from "@/components/portal/ui";
import { getMe } from "@/lib/portal.functions";
import { SARAH, SARAH_VCARD, sarahSmsHref } from "@/lib/sarah-support";

export function SarahContact({ firstName, publicView = false }: { firstName?: string | null; publicView?: boolean }) {
  function saveContact() {
    const url = URL.createObjectURL(new Blob([SARAH_VCARD], { type: "text/vcard;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "Sarah-Bennett.vcf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className={publicView ? "mt-6 border-y border-vantage-gold/30 py-6 text-left" : "border-y border-border py-5"} aria-label="Sarah Bennett support">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <h2 className={publicView ? "font-display text-2xl text-vantage-ivory" : "p-section-title"}>Meet Sarah — Your Vantage Assistant</h2>
          <p className={publicView ? "mt-1 text-sm text-vantage-gold" : "p-muted mt-1"}>{SARAH.title}</p>
          <p className={publicView ? "mt-2 text-sm text-vantage-muted" : "p-secondary mt-2"}>Sarah is KJ’s executive assistant. She’ll guide you through your pre-licensing course, study material, exam prep, and getting contracted.</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2">
          <a className={publicView ? "vantage-btn-primary inline-flex items-center gap-2 px-4 py-3" : btnClass("primary")} href={sarahSmsHref(firstName)}><MessageSquare size={16} aria-hidden />Text Sarah (+1 469-798-3518)</a>
          <div className="flex flex-wrap gap-2">
            <a className={publicView ? "vantage-btn-ghost inline-flex items-center gap-2 px-3 py-2" : btnClass("secondary", "sm")} href={`mailto:${SARAH.email}`}><Mail size={15} aria-hidden />Email Sarah</a>
            <Button size="sm" onClick={saveContact}><ContactRound size={15} aria-hidden />Save to Contacts</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PortalSarahContact() {
  const getProfile = useServerFn(getMe);
  const q = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  return <SarahContact firstName={q.data?.profile?.first_name} />;
}