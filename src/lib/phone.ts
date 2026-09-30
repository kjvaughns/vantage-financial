/** Phone display + input helpers.
 *
 *  Storage stays whatever the user typed; formatting is applied at the edges so
 *  US numbers read consistently as (555) 123-4567 across the portal and emails.
 */

/** Digits-only, dropping a leading US country code. */
function digits(raw: string): { local: string; country: string } {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return { local: d.slice(1), country: "1" };
  return { local: d, country: "" };
}

/** Pretty-print a phone number. Non-US / partial values are returned as-is. */
export function formatPhone(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("+") && !/^\+1/.test(trimmed)) return trimmed; // intl — leave alone
  const { local } = digits(trimmed);
  if (local.length !== 10) return trimmed;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/** Progressive formatting for a controlled <input type="tel">. */
export function formatPhoneInput(raw: string): string {
  if (raw.trim().startsWith("+")) return raw.replace(/[^\d+\s()-]/g, "");
  const { local } = digits(raw);
  const d = local.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** tel:/sms: href value — digits only (E.164-ish). */
export function phoneHref(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const { local } = digits(trimmed);
  if (!local) return undefined;
  return local.length === 10 ? `+1${local}` : local;
}

/** True for a real-looking US number: 10 digits, area code and exchange not starting with 0/1. */
export function isValidUsPhone(raw: string): boolean {
  const { local } = digits(raw.trim());
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(local);
}
