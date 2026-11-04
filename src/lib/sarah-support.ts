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

export const SARAH_VCARD = [
  "BEGIN:VCARD", "VERSION:3.0", "N:Bennett;Sarah;;;", "FN:Sarah Bennett",
  "ORG:Vantage Financial", "TITLE:Executive Assistant to KJ Vaughns",
  "TEL;TYPE=CELL:+14697983518", `EMAIL:${SARAH.email}`, "END:VCARD", "",
].join("\r\n");

export const SARAH_INTRO = "Sarah Bennett is KJ’s executive assistant and your Vantage point of contact for onboarding, pre-licensing guidance, study check-ins, state exam scheduling, and day-to-day questions.";
export const SARAH_TEXT_PROMPT = "Save Sarah to your contacts right now at (469) 798-3518. Shoot her a quick text with your name so she can track your pre-licensing progress and make sure you're ready for test day. Already licensed? Text her for onboarding and contracting support.";