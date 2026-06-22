import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/button";
import { authClient } from "../lib/auth";
import { getSession } from "../server-functions/session";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.user) throw redirect({ to: "/signin" });
  },
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    navigate({ to: "/signin" });
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <div className="text-xs text-gray-500">Signed in as</div>
          <div className="text-sm font-medium">
            {session?.user?.email ?? "—"}
          </div>
        </div>

        <Button onClick={handleSignOut} className="self-start">
          Disconnect Gmail + sign out
        </Button>

        <p className="text-xs text-gray-500">
          SubTally does not store email content — only extracted subscription
          metadata.
        </p>
      </div>
    </Layout>
  );
}
