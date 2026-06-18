import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSession } from "../server-functions/session";

// Layout route for /dashboard/*: guards the whole section, renders children.
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.user) throw redirect({ to: "/signin" });
  },
  component: () => <Outlet />,
});
