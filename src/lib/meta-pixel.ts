// Meta Pixel helpers. Events are fired on the application success pages so they
// reliably run on page load (a submit-time event can be cut off by the redirect).
// De-duped per application token via sessionStorage so refreshes don't double count.

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fn === "function" ? fn : null;
}

export function trackApplicationLead(token: string, licensed: boolean) {
  const track = fbq();
  if (!track) return;
  const key = `vantage_lead_fired_${token}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage unavailable — still fire once for this page view.
  }
  const params = {
    content_name: "Vantage Financial Application",
    content_category: licensed ? "Licensed" : "Unlicensed",
    status: "submitted",
  };
  // Standard event (used for campaign optimization).
  track("track", "Lead", params);
  // Custom event matching the "Submit application" event set up in Events Manager.
  track("trackCustom", "Submit application", params);
}
