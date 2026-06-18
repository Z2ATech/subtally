import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "../lib/auth";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", exact: true },
  { to: "/dashboard/upcoming", label: "Upcoming", exact: false },
  { to: "/dashboard/services", label: "Services", exact: false },
  { to: "/settings", label: "Settings", exact: false },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    navigate({ to: "/signin" });
  }

  return (
    <div className="min-h-screen w-full">
      <header className="border-b border-gray-200">
        <nav className="flex flex-wrap items-center gap-1 p-3">
          <span className="mr-3 text-lg font-semibold">SubTally</span>
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.exact }}
              className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm text-gray-700"
              activeProps={{ className: "font-semibold text-black" }}
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-auto inline-flex min-h-[44px] items-center rounded-md border border-gray-300 px-3 text-sm"
          >
            Sign out
          </button>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl p-4">{children}</main>
    </div>
  );
}
