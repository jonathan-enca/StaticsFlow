// History page — /history
// Shows all generated creatives across all brands, filterable.
// Placeholder — full implementation in a future phase (SPECS.md §6.1 "Historique").

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppNavbar from "@/components/AppNavbar";

export const metadata = {
  title: "History — StaticsFlow",
  description: "All your generated creatives in one place.",
};

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userBrands = await prisma.brand.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true },
  });

  return (
    <main className="min-h-screen" style={{ background: "var(--sf-bg-primary)" }}>
      <AppNavbar
        email={session.user?.email}
        brands={userBrands}
        isAdmin={session.user?.isAdmin}
      />

      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
          style={{ background: "var(--sf-bg-elevated)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--sf-accent)" }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--sf-text-primary)" }}>
          History
        </h1>
        <p className="text-sm" style={{ color: "var(--sf-text-secondary)" }}>
          All your generated creatives will appear here. Coming soon.
        </p>
        <a
          href="/dashboard"
          className="inline-block mt-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-80"
          style={{ background: "var(--sf-accent)" }}
        >
          Back to Dashboard
        </a>
      </div>
    </main>
  );
}
