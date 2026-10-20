import { createFileRoute, redirect } from "@tanstack/react-router";

/** Call Coach now lives inside the Training Hub — send old links there. */
export const Route = createFileRoute("/_authenticated/portal/coach/")({
  beforeLoad: () => {
    throw redirect({ to: "/portal/training", search: { tab: "coach" } });
  },
});
