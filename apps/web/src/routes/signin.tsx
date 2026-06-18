import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "../lib/auth";

export const Route = createFileRoute("/signin")({
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session?.user) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <button
        type="button"
        onClick={() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}/dashboard`,
          })
        }
        className="min-h-[44px] rounded-md bg-black px-6 py-3 text-white"
      >
        Sign in with Google
      </button>
    </div>
  );
}
