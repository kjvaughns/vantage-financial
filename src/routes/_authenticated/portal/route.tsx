import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/vantage/theme";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/portal")({
  // Deactivated accounts are signed out and sent back to the login page.
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase.from("profiles").select("is_active").eq("id", auth.user.id).maybeSingle();
    if (data && data.is_active === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  ),
});
