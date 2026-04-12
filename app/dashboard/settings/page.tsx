// /dashboard/settings — manage BYOK API keys saved to the user's account
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ApiKeysClient from "./ApiKeysClient";
import AppNavbar from "@/components/AppNavbar";

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
      <AppNavbar email={session.user?.email} />

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
