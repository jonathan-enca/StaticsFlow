// Inspiration Library page — /library
// Accessible to all authenticated users.
// Server component: fetches initial favorite IDs, then renders interactive client.

import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LibraryClient from "./LibraryClient";

export const metadata = {
  title: "Inspiration Library — StaticsFlow",
  description: "Browse the living database of high-performing ad creatives.",
};

export default async function LibraryPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session?.user?.id) redirect("/login");

  // Pre-fetch user's favorite IDs on the server for instant rendering
  const favorites = await prisma.userFavorite.findMany({
    where: { userId: session.user.id },
    select: { templateId: true },
  });
  const favoriteIds = favorites.map((f) => f.templateId);

  // Count analyzed templates for the header stat
  const totalTemplates = await prisma.template.count({
    where: { analyzedAt: { not: null } },
  });

  return (
    <main className="min-h-screen" style={{ background: 'var(--sf-bg-primary)' }}>
      {/* Navbar */}
      <nav
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{ background: 'var(--sf-bg-secondary)', borderColor: 'var(--sf-border)' }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: 'var(--sf-accent)' }}
            >
              <span className="text-white font-bold text-sm font-display">S</span>
            </div>
            <span
              className="text-lg font-bold font-display"
              style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.02em' }}
            >
              <span style={{ color: 'var(--sf-accent)' }}>S</span>taticsFlow
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <a
              href="/dashboard"
              className="px-3 py-1.5 text-sm rounded-md transition-opacity hover:opacity-80"
              style={{ color: 'var(--sf-text-secondary)' }}
            >
              Dashboard
            </a>
            <a
              href="/library"
              className="px-3 py-1.5 text-sm font-medium rounded-md"
              style={{ color: 'var(--sf-text-primary)', background: 'var(--sf-bg-elevated)' }}
            >
              Library
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--sf-text-secondary)' }}>{session.user?.email}</span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--sf-text-secondary)' }}
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-2 font-display"
            style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.01em' }}
          >
            Inspiration Library
          </h1>
          <p style={{ color: 'var(--sf-text-secondary)' }}>
            {totalTemplates > 0
              ? `${totalTemplates.toLocaleString()} curated creatives — updated continuously.`
              : "Creatives will appear here once uploaded in the BDD Manager."}
          </p>
        </div>

        {/* Client: grid + filters + favorites + modal */}
        <Suspense
          fallback={
            <div className="flex gap-8">
              <div className="w-56 flex-shrink-0 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-md animate-pulse" style={{ background: 'var(--sf-bg-elevated)' }} />
                ))}
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg animate-pulse" style={{ background: 'var(--sf-bg-elevated)' }} />
                ))}
              </div>
            </div>
          }
        >
          <LibraryClient initialFavoriteIds={favoriteIds} />
        </Suspense>
      </div>
    </main>
  );
}
