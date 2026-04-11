// Protected dashboard — lists brands with Brand DNA enrichment links
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";

export default async function DashboardPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session) redirect("/login");

  const brands = await prisma.brand.findMany({
    where: { userId: session.user!.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
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
          <div className="flex items-center gap-1">
            <a
              href="/dashboard"
              className="px-3 py-1.5 text-sm font-medium text-gray-900 bg-gray-100 rounded-lg"
            >
              Dashboard
            </a>
            <a
              href="/library"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Library
            </a>
          </div>
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

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h1>
            <p className="text-gray-500">
              Welcome back, {session.user?.name ?? session.user?.email}
            </p>
          </div>
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            + New brand
          </a>
        </div>

        {brands.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✨</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No brands yet</h2>
            <p className="text-gray-500 text-sm mb-6">
              Start by extracting your Brand DNA from your website URL.
            </p>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Extract Brand DNA →
            </a>
          </div>
        ) : (
          /* Brand list */
          <div className="grid gap-4">
            {brands.map((brand) => {
              const dna = (brand.brandDnaJson ?? {}) as Partial<ExtractedBrandDNA>;
              const enrichmentScore = computeEnrichmentScore(dna);
              const primaryColor = dna.colors?.primary ?? "#000000";

              return (
                <div
                  key={brand.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between gap-4 hover:border-gray-300 transition-colors"
                >
                  {/* Color swatch + info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-12 h-12 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{brand.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{brand.url}</p>
                    </div>
                  </div>

                  {/* Enrichment status */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400 mb-1">Brand DNA enrichment</p>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: `${enrichmentScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{enrichmentScore}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/dashboard/brands/${brand.id}`}
                        className="px-3 py-2 text-sm font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap"
                      >
                        Enrich DNA
                      </a>
                      <a
                        href={`/dashboard/brands/${brand.id}/generate`}
                        className="px-3 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
                      >
                        Generate →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Compute a 0–100 enrichment score based on which enrichment fields are populated.
 * Used to show users how complete their Brand DNA is.
 */
function computeEnrichmentScore(dna: Partial<ExtractedBrandDNA>): number {
  const checks = [
    // Base fields (40 points)
    !!dna.colors?.primary,                    // 8
    (dna.keyBenefits?.length ?? 0) > 0,       // 8
    (dna.personas?.length ?? 0) > 0,          // 8
    !!dna.toneOfVoice,                         // 8
    !!dna.brandVoice,                          // 8
    // Enrichment fields (60 points)
    !!dna.customerVocabulary,                  // 15
    (dna.forbiddenWords?.length ?? 0) > 0,    // 8
    (dna.requiredWording?.length ?? 0) > 0,   // 7
    !!dna.brandBrief,                          // 10
    (dna.structuredPersonas?.length ?? 0) > 0, // 10
    (dna.customAssets?.length ?? 0) > 0,      // 10
  ];
  const weights = [8, 8, 8, 8, 8, 15, 8, 7, 10, 10, 10];
  const score = checks.reduce((sum, ok, i) => sum + (ok ? weights[i] : 0), 0);
  return Math.min(100, score);
}
