import { expect, it } from "vitest";
import { renderEmail } from "./render.server";

it("keeps onboarding invitations limited to account creation even with assistant support", async () => {
  const url = "https://vantage-financial.net/portal-invite/test";
  for (const template of ["onboarding-invitation", "welcome-onboarding"]) {
    const email = await renderEmail(template, { context: { first_name: "Ava", invitation_link: url, onboarding_link: url } });
    const links = Array.from(email.html.matchAll(/href="([^"]+)"/g), (m) => m[1]);
    expect(links).toEqual([url]);
  }
});