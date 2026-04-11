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
  const session = await auth();
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
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold text-gray-900">StaticsFlow</span>
          </div>
          <nav className="flex items-center gap-1">
            <a
              href="/dashboard"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/library"
              className="px-3 py-1.5 text-sm font-medium text-gray-900 bg-gray-100 rounded-lg"
            >
              Library
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{session.user?.email}</span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Inspiration Library
          </h1>
          <p className="text-gray-500">
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
                  <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
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
