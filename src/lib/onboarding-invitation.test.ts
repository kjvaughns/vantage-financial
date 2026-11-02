import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ensureOnboardingInvitation } from "./onboarding-invitation.server";

function callerFor(data: { id: string } | null, error: { message: string } | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient<Database>, from, select, eq };
}

describe("onboarding invitation access", () => {
  it("uses the service-only function after verifying caller access to the applicant", async () => {
    const caller = callerFor({ id: "applicant-1" });
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, token: "test-token" }, error: null });
    const service = vi.fn(async () => ({ rpc }) as unknown as SupabaseClient<Database>);
    await expect(ensureOnboardingInvitation(caller.client, "applicant-1", service))
      .resolves.toEqual({ ok: true, token: "test-token" });
    expect(caller.from).toHaveBeenCalledWith("applicants");
    expect(caller.eq).toHaveBeenCalledWith("id", "applicant-1");
    expect(rpc).toHaveBeenCalledWith("ensure_onboarding_invitation", { _applicant_id: "applicant-1" });
  });

  it("never loads a privileged client when RLS hides the applicant", async () => {
    const service = vi.fn();
    await expect(ensureOnboardingInvitation(callerFor(null).client, "outside", service))
      .rejects.toThrow("don't have permission");
    expect(service).not.toHaveBeenCalled();
  });

  it("does not bypass failed caller access checks", async () => {
    const service = vi.fn();
    await expect(ensureOnboardingInvitation(callerFor(null, { message: "Access check failed" }).client, "outside", service))
      .rejects.toThrow("Access check failed");
    expect(service).not.toHaveBeenCalled();
  });
});