import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Authorize against the caller's RLS scope before invoking the service-only RPC. */
export async function ensureOnboardingInvitation(
  caller: SupabaseClient<Database>,
  applicantId: string,
  serviceClient: () => Promise<SupabaseClient<Database>>,
) {
  const { data: applicant, error: accessError } = await caller
    .from("applicants")
    .select("id")
    .eq("id", applicantId)
    .maybeSingle();
  if (accessError) throw new Error(accessError.message);
  if (!applicant) throw new Error("Applicant not found or you don't have permission to invite them.");

  const service = await serviceClient();
  const { data, error } = await service.rpc("ensure_onboarding_invitation", {
    _applicant_id: applicant.id,
  });
  if (error) throw new Error(error.message);
  return data;
}