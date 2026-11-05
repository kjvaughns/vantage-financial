import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/admin")({
  beforeLoad: async ({ location }) => {
    const me = await getMe();
    const roles = me?.roles ?? [];
    if (!roles.some((r: string) => r === "admin" || r === "super_admin")) {
      // Trainers (training_reviewers) may open Training Admin only.
      if (location.pathname.startsWith("/portal/admin/training")) {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const { data } = await supabase.rpc("is_training_reviewer", { _uid: auth.user.id });
          if (data === true) return;
        }
      }
      throw redirect({ to: "/portal" });
    }
  },
  component: () => <Outlet />,
});
