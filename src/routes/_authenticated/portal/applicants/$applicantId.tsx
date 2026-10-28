import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageBody } from "@/components/portal/ui";
import { ApplicantRecord } from "@/components/vantage/applicant-record";

export const Route = createFileRoute("/_authenticated/portal/applicants/$applicantId")({
  head: () => ({
    meta: [
      { title: "Applicant Profile — Vantage Financial" },
      { name: "description", content: "Review applicant details, recruiter, upline, and progress in Vantage Financial." },
      { property: "og:title", content: "Applicant Profile — Vantage Financial" },
      { property: "og:description", content: "Review applicant details and recruiting progress in Vantage Financial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplicantDetailPage,
});

function ApplicantDetailPage() {
  const { applicantId } = Route.useParams();
  return (
    <PortalShell>
      <PageBody>
        <ApplicantRecord applicantId={applicantId} variant="page" />
      </PageBody>
    </PortalShell>
  );
}
