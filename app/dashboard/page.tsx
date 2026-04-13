// Protected dashboard — lists brands with 3-pillar completion checklist (STA-96 Phase D)
// Pillars: Brand DNA / Product DNA / Inspirations (0/5)
// "Generate" CTA unlocks when all 3 pillars are complete (soft gate — warns but never blocks)
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import { Sparkles, Check, AlertCircle } from "lucide-react";
import AppNavbar from "@/components/AppNavbar";

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
    include: {
      _count: {
        select: { products: true, inspirations: true },
      },
    },
  });

  return (
    <main className="min-h-screen" style={{ background: "var(--sf-bg-primary)" }}>
      <AppNavbar email={session.user?.email} />

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1
              className="text-3xl font-bold mb-1 font-display"
              style={{ color: "var(--sf-text-primary)", letterSpacing: "-0.01em" }}
            >
              Dashboard
            </h1>
            <p style={{ color: "var(--sf-text-secondary)" }}>
              Welcome back, {session.user?.name ?? session.user?.email}
            </p>
          </div>
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            style={{ background: "var(--sf-accent)" }}
          >
            + New brand
          </a>
        </div>

        {brands.length === 0 ? (
          /* Empty state */
          <div
            className="rounded-lg border-2 border-dashed p-16 text-center"
            style={{ borderColor: "var(--sf-border)" }}
          >
            <div
              className="w-12 h-12 rounded-md flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--sf-accent-muted)" }}
            >
              <Sparkles className="w-6 h-6" style={{ color: "var(--sf-accent)" }} />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--sf-text-primary)" }}>
              No brands yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--sf-text-secondary)" }}>
              Start by extracting your Brand DNA from your website URL.
            </p>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
              style={{ background: "var(--sf-accent)" }}
            >
              Extract Brand DNA →
            </a>
          </div>
        ) : (
          <div className="grid gap-6">
            {brands.map((brand) => {
              const dna = (brand.brandDnaJson ?? {}) as Partial<ExtractedBrandDNA>;
              const primaryColor = dna.colors?.primary ?? "var(--sf-accent)";
              const productCount = brand._count.products;
              const inspirationCount = brand._count.inspirations;

              // 3-pillar readiness
              const pillar1Done = true; // Brand DNA always complete (brand exists)
              const pillar2Done = productCount >= 1;
              const pillar3Done = inspirationCount >= 5;
              const allDone = pillar1Done && pillar2Done && pillar3Done;
              const pillarsComplete = [pillar1Done, pillar2Done, pillar3Done].filter(Boolean).length;

              return (
                <div
                  key={brand.id}
                  className="rounded-xl border p-6 space-y-5"
                  style={{
                    background: "var(--sf-bg-secondary)",
                    borderColor: "var(--sf-border)",
                  }}
                >
                  {/* Brand header */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-12 h-12 rounded-lg flex-shrink-0 border"
                        style={{
                          backgroundColor: primaryColor,
                          borderColor: "var(--sf-border)",
                        }}
                      />
                      <div className="min-w-0">
                        <h3
                          className="font-semibold truncate"
                          style={{ color: "var(--sf-text-primary)" }}
                        >
                          {brand.name}
                        </h3>
                        <p className="text-sm truncate" style={{ color: "var(--sf-text-secondary)" }}>
                          {brand.url}
                        </p>
                      </div>
                    </div>

                    {/* Pillar count badge */}
                    <div
                      className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: allDone
                          ? "rgba(52,199,89,0.12)"
                          : "var(--sf-bg-elevated)",
                        color: allDone
                          ? "var(--sf-success)"
                          : "var(--sf-text-muted)",
                      }}
                    >
                      {pillarsComplete}/3 pillars ready
                    </div>
                  </div>

                  {/* 3-pillar progress */}
                  <div className="grid grid-cols-3 gap-3">
                    <PillarCard
                      label="Brand DNA"
                      done={pillar1Done}
                      detail="Extracted"
                      href={`/dashboard/brands/${brand.id}`}
                      actionLabel="Enrich →"
                    />
                    <PillarCard
                      label="Product DNA"
                      done={pillar2Done}
                      detail={productCount === 0 ? "No products" : `${productCount} product${productCount > 1 ? "s" : ""}`}
                      href={`/dashboard/brands/${brand.id}/products`}
                      actionLabel={productCount === 0 ? "Add product →" : "Manage →"}
                    />
                    <PillarCard
                      label="Inspirations"
                      done={pillar3Done}
                      detail={`${inspirationCount}/5 uploaded`}
                      href={`/dashboard/brands/${brand.id}/inspirations`}
                      actionLabel={inspirationCount === 0 ? "Add inspirations →" : `Add ${5 - inspirationCount} more →`}
                    />
                  </div>

                  {/* Generate CTA */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex-1">
                      {!allDone && (
                        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--sf-text-muted)" }}>
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          {!pillar2Done && !pillar3Done
                            ? "Add a product and 5 inspirations to unlock the best results"
                            : !pillar2Done
                            ? "Add a product to unlock full generation"
                            : `Add ${5 - inspirationCount} more inspiration${5 - inspirationCount !== 1 ? "s" : ""} for better results`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={`/dashboard/brands/${brand.id}`}
                        className="px-3 py-2 text-sm font-medium rounded-md hover:opacity-80 transition-opacity whitespace-nowrap"
                        style={{
                          background: "var(--sf-accent-muted)",
                          color: "var(--sf-accent)",
                        }}
                      >
                        Enrich DNA
                      </a>
                      <a
                        href={`/dashboard/brands/${brand.id}/generate`}
                        className="px-4 py-2 text-sm font-semibold text-white rounded-md hover:opacity-90 transition-opacity whitespace-nowrap flex items-center gap-1.5"
                        style={{ background: "var(--sf-accent)" }}
                        title={
                          allDone
                            ? "Generate a creative"
                            : "You can still generate — results improve with more pillars complete"
                        }
                      >
                        {allDone ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Generate
                          </>
                        ) : (
                          "Generate →"
                        )}
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

// ── Pillar card ──────────────────────────────────────────────────────────────

function PillarCard({
  label,
  done,
  detail,
  href,
  actionLabel,
}: {
  label: string;
  done: boolean;
  detail: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{
        background: done
          ? "rgba(52,199,89,0.05)"
          : "var(--sf-bg-primary)",
        borderColor: done ? "rgba(52,199,89,0.2)" : "var(--sf-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: done
              ? "var(--sf-success)"
              : "var(--sf-bg-elevated)",
          }}
        >
          {done ? (
            <Check className="w-3 h-3 text-white" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--sf-text-muted)" }} />
          )}
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color: done ? "var(--sf-success)" : "var(--sf-text-primary)" }}
        >
          {label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
        {detail}
      </p>
      {!done && (
        <a
          href={href}
          className="block text-xs font-medium hover:underline"
          style={{ color: "var(--sf-accent)" }}
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

// Kept for potential future use
function computeEnrichmentScore(dna: Partial<ExtractedBrandDNA>): number {
  const checks = [
    !!dna.colors?.primary,
    (dna.keyBenefits?.length ?? 0) > 0,
    (dna.personas?.length ?? 0) > 0,
    !!dna.toneOfVoice,
    !!dna.brandVoice,
    !!dna.customerVocabulary,
    (dna.forbiddenWords?.length ?? 0) > 0,
    (dna.requiredWording?.length ?? 0) > 0,
    !!dna.brandBrief,
    (dna.structuredPersonas?.length ?? 0) > 0,
    (dna.customAssets?.length ?? 0) > 0,
  ];
  const weights = [8, 8, 8, 8, 8, 15, 8, 7, 10, 10, 10];
  return Math.min(100, checks.reduce((sum, ok, i) => sum + (ok ? weights[i] : 0), 0));
}
