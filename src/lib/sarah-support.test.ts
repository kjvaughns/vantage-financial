import { expect, it } from "vitest";
import { SARAH, SARAH_VCARD, sarahSmsHref } from "./sarah-support";
it("opens Sarah's requested number with the applicant's name", () => {
  const href = sarahSmsHref("Ava");
  expect(href.startsWith("sms:+14697983518?&body=")).toBe(true);
  expect(decodeURIComponent(href.split("body=")[1])).toBe("Hey Sarah, it's Ava!");
  expect(SARAH.email).toBe("sarah@vantage-financial.net");
});
it("exports Sarah's phone and email as a phone contact", () => {
  expect(SARAH_VCARD).toContain("TEL;TYPE=CELL:+14697983518");
  expect(SARAH_VCARD).toContain("EMAIL:sarah@vantage-financial.net");
});