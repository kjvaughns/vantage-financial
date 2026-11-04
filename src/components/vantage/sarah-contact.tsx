import { MessageSquare } from "lucide-react";
import { SARAH, sarahSmsHref } from "@/lib/sarah-support";

/**
 * Subtle one-line point-of-contact note. Sarah is a resource, not a banner —
 * keep this small and inline wherever it appears.
 */
export function SarahContact({ firstName, publicView = false }: { firstName?: string | null; publicView?: boolean }) {
  return (
    <p
      className={
        publicView
          ? "mt-6 text-left text-[13px] leading-relaxed text-vantage-dim"
          : "text-[13px] leading-relaxed text-[var(--p-muted)]"
      }
    >
      Questions? Your point of contact is {SARAH.name} —{" "}
      <a className="underline underline-offset-2" href={sarahSmsHref(firstName)}>
        text her at {SARAH.phone}
      </a>{" "}
      or{" "}
      <a className="underline underline-offset-2" href={`mailto:${SARAH.email}`}>
        {SARAH.email}
      </a>
      .
      <MessageSquare size={12} className="ml-1 inline-block align-[-1px] opacity-60" aria-hidden />
    </p>
  );
}
