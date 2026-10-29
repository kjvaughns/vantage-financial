export type ApplicantScope = "mine" | "direct" | "downline" | "all";

/** RLS remains the authorization boundary; admins' organization includes company leads. */
export function effectiveApplicantScope(scope: ApplicantScope, isAdmin: boolean): ApplicantScope {
  return scope === "downline" && isAdmin ? "all" : scope;
}