export const SARAH = {
  name: "Sarah Bennett",
  title: "Executive Assistant to KJ Vaughns | Vantage Financial",
  phone: "+1 469-798-3518",
  email: "sarah@vantage-financial.net",
  sms: "sms:+14697983518",
};

export function sarahSmsHref(firstName?: string | null) {
  const name = firstName?.trim() || "a Vantage applicant";
  return `${SARAH.sms}?&body=${encodeURIComponent(`Hey Sarah, it's ${name}!`)}`;
}

