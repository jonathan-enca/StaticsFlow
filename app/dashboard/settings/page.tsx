// /dashboard/settings — manage BYOK API keys saved to the user's account
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ApiKeysClient from "./ApiKeysClient";

export default async function SettingsPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user!.id as string },
    select: { anthropicApiKey: true, geminiApiKey: true, email: true },
  });

  return (
    <main className="min-h-screen" style={{ background: "var(--sf-bg-primary)" }}>
      {/* Navbar */}
      <nav
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{ background: "var(--sf-bg-secondary)", borderColor: "var(--sf-border)" }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: "var(--sf-accent)" }}
            >
              <span className="text-white font-bold text-sm font-display">S</span>
            </div>
            <span
              className="text-lg font-bold font-display"
              style={{ color: "var(--sf-text-primary)", letterSpacing: "-0.02em" }}
            >
              <span style={{ color: "var(--sf-accent)" }}>S</span>taticsFlow
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/dashboard"
              className="px-3 py-1.5 text-sm rounded-md transition-colors hover:opacity-80"
              style={{ color: "var(--sf-text-secondary)" }}
            >
              Dashboard
            </a>
            <a
              href="/library"
              className="px-3 py-1.5 text-sm rounded-md transition-colors hover:opacity-80"
              style={{ color: "var(--sf-text-secondary)" }}
            >
              Library
            </a>
            <a
              href="/dashboard/settings"
              className="px-3 py-1.5 text-sm font-medium rounded-md"
              style={{ color: "var(--sf-text-primary)", background: "var(--sf-bg-elevated)" }}
            >
              Settings
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "var(--sf-text-secondary)" }}>{session.user?.email}</span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: "var(--sf-text-secondary)" }}
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-1 font-display"
            style={{ color: "var(--sf-text-primary)", letterSpacing: "-0.01em" }}
          >
            Settings
          </h1>
          <p style={{ color: "var(--sf-text-secondary)" }}>
            Manage your account and API keys.
          </p>
        </div>

        <ApiKeysClient
          initialAnthropicPreview={
            user?.anthropicApiKey ? `${user.anthropicApiKey.slice(0, 10)}…` : null
          }
          initialGeminiPreview={
            user?.geminiApiKey ? `${user.geminiApiKey.slice(0, 8)}…` : null
          }
        />
      </div>
    </main>
  );
}
