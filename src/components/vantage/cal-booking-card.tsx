import { useEffect, useState } from "react";

export const CAL_BOOKING_URL = "https://cal.com/kjvaughns/15min";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Shows "You're booked" when the Cal.com booking was made on submit, otherwise a Cal.com fallback button. */
export function CalBookingCard({
  token,
  chosenIso,
  scheduled,
}: {
  token: string;
  chosenIso: string | null;
  scheduled: boolean;
}) {
  const [storedIso, setStoredIso] = useState<string | null>(null);
  useEffect(() => {
    setStoredIso(sessionStorage.getItem(`vantage_booked_${token}`));
  }, [token]);

  const iso = storedIso || chosenIso;
  const booked = Boolean(storedIso) || (scheduled && Boolean(chosenIso));
  const label = iso ? fmt.format(new Date(iso)) + " CT" : null;

  return (
    <div className="vantage-card vantage-card-gold mt-10 flex flex-col items-start gap-4 p-6 text-left md:flex-row md:items-center md:justify-between md:p-8">
      <div>
        <div className="font-display text-[24px] leading-tight text-vantage-ivory">
          {booked ? "You're booked for your 1:1 interview" : "Book your 1:1 interview call"}
        </div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-vantage-muted">
          {booked
            ? `Confirmed for ${label}. The calendar invite is in your email — watch the video above before we talk.`
            : "Pick a time that works for a quick 1:1 call with KJ Vaughns."}
        </p>
      </div>
      {booked ? (
        <span className="flex-none rounded-full border border-vantage-gold/40 bg-vantage-gold/[0.1] px-4 py-2 text-[13px] font-semibold text-vantage-gold">
          Booked ✓
        </span>
      ) : (
        <a
          href={CAL_BOOKING_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="vantage-btn-primary flex-none px-6 py-3.5 text-[15px]"
        >
          Book my 1:1 call →
        </a>
      )}
    </div>
  );
}
