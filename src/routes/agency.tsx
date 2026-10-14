import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { z } from "zod";
import { getRecruiterBySlug } from "@/lib/applications.functions";
import { saveReferral } from "@/lib/referral";

// Every agency page (/agency, /agency/path, /agency/apply) credits ?ref= links
// the same way the home page does.
export const Route = createFileRoute("/agency")({
  validateSearch: (s) => z.object({ ref: z.string().optional() }).passthrough().parse(s),
  component: AgencyLayout,
});

function AgencyLayout() {
  const { ref } = Route.useSearch();
  const resolve = useServerFn(getRecruiterBySlug);
  useEffect(() => {
    if (!ref) return;
    const landing_url = window.location.href;
    resolve({ data: { slug: ref } })
      .then((recruiter) => saveReferral({ slug: ref, recruiter, landing_url, invalid: !recruiter }))
      .catch(() => saveReferral({ slug: ref, recruiter: null, landing_url, invalid: true }));
  }, [ref, resolve]);
  return <Outlet />;
}
