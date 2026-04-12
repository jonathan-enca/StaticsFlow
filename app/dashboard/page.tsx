// Protected dashboard — lists brands with Brand DNA enrichment links
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import { Sparkles } from "lucide-react";

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
          <div className="flex items-center gap-1">
            <a
              href="/dashboard"
              className="px-3 py-1.5 text-sm font-medium rounded-md"
              style={{ color: 'var(--sf-text-primary)', background: 'var(--sf-bg-elevated)' }}
            >
              Dashboard
            </a>
            <a
              href="/library"
              className="px-3 py-1.5 text-sm rounded-md transition-colors hover:opacity-80"
              style={{ color: 'var(--sf-text-secondary)' }}
            >
              Library
            </a>
            <a
              href="/dashboard/settings"
              className="px-3 py-1.5 text-sm rounded-md transition-colors hover:opacity-80"
              style={{ color: 'var(--sf-text-secondary)' }}
            >
              Settings
            </a>
          </div>
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

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1
              className="text-3xl font-bold mb-1 font-display"
              style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.01em' }}
            >
              Dashboard
            </h1>
            <p style={{ color: 'var(--sf-text-secondary)' }}>
              Welcome back, {session.user?.name ?? session.user?.email}
            </p>
          </div>
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            style={{ background: 'var(--sf-accent)' }}
          >
            + New brand
          </a>
        </div>

        {brands.length === 0 ? (
          /* Empty state */
          <div
            className="rounded-lg border-2 border-dashed p-16 text-center"
            style={{ borderColor: 'var(--sf-border)' }}
          >
            <div
              className="w-12 h-12 rounded-md flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--sf-accent-muted)' }}
            >
              <Sparkles className="w-6 h-6" style={{ color: 'var(--sf-accent)' }} />
            </div>
            <h2
              className="text-lg font-semibold mb-2"
              style={{ color: 'var(--sf-text-primary)' }}
            >
              No brands yet
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--sf-text-secondary)' }}>
              Start by extracting your Brand DNA from your website URL.
            </p>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
              style={{ background: 'var(--sf-accent)' }}
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
                  className="rounded-lg border p-6 flex items-center justify-between gap-4 hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--sf-bg-secondary)', borderColor: 'var(--sf-border)' }}
                >
                  {/* Color swatch + info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-12 h-12 rounded-md flex-shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <div className="min-w-0">
                      <h3
                        className="font-semibold truncate"
                        style={{ color: 'var(--sf-text-primary)' }}
                      >
                        {brand.name}
                      </h3>
                      <p
                        className="text-sm truncate"
                        style={{ color: 'var(--sf-text-secondary)' }}
                      >
                        {brand.url}
                      </p>
                    </div>
                  </div>

                  {/* Enrichment status */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs mb-1" style={{ color: 'var(--sf-text-muted)' }}>Brand DNA enrichment</p>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-24 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--sf-bg-elevated)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${enrichmentScore}%`, background: 'var(--sf-accent)' }}
                          />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--sf-text-secondary)' }}>{enrichmentScore}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/dashboard/brands/${brand.id}`}
                        className="px-3 py-2 text-sm font-medium rounded-md hover:opacity-80 transition-opacity whitespace-nowrap"
                        style={{ background: 'var(--sf-accent-muted)', color: 'var(--sf-accent)' }}
                      >
                        Enrich DNA
                      </a>
                      <a
                        href={`/dashboard/brands/${brand.id}/generate`}
                        className="px-3 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
                        style={{ background: 'var(--sf-accent)' }}
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
