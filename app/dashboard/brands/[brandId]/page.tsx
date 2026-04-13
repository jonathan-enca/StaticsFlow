// Brand DNA enrichment page — server component
// Route: /dashboard/brands/[brandId]
// Loads the brand from DB, then renders the enrichment client.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import BrandDnaClient from "./BrandDnaClient";
import AppNavbar from "@/components/AppNavbar";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function BrandDnaPage({ params }: PageProps) {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session?.user?.id) redirect("/login");

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });

  if (!brand) notFound();

  const dna = (brand.brandDnaJson ?? {}) as unknown as ExtractedBrandDNA;

  // Ensure required arrays exist (backward compat with Phase 1 records)
  const safeDna: ExtractedBrandDNA = {
    // ── Auto-extracted (Phase 1) ─────────────────────────────────────────────
    name: dna.name ?? brand.name,
    url: dna.url ?? brand.url,
    colors: dna.colors ?? { primary: "#000000", secondary: "#ffffff", accent: "#000000" },
    fonts: dna.fonts ?? [],
    logoUrl: dna.logoUrl ?? null,
    productImages: dna.productImages ?? [],
    lifestyleImages: dna.lifestyleImages ?? [],
    toneOfVoice: dna.toneOfVoice ?? "",
    language: dna.language ?? "en",
    keyBenefits: dna.keyBenefits ?? [],
    personas: dna.personas ?? [],
    brandVoice: dna.brandVoice ?? "",
    forbiddenWords: dna.forbiddenWords ?? [],
    productCategory: dna.productCategory ?? "other",
    // ── Identity & Positioning (STA-55) ─────────────────────────────────────
    brandArchetype: dna.brandArchetype,
    pricePositioning: dna.pricePositioning,
    targetMarkets: dna.targetMarkets ?? [],
    differentiators: dna.differentiators ?? [],
    // ── Voice & Messaging (STA-55) ───────────────────────────────────────────
    brandVoiceAdjectives: dna.brandVoiceAdjectives ?? [],
    mandatoryMentions: dna.mandatoryMentions ?? [],
    messagingHierarchy: dna.messagingHierarchy ?? [],
    callToActionExamples: dna.callToActionExamples ?? [],
    // ── Creative Direction (STA-55) ──────────────────────────────────────────
    visualStyleKeywords: dna.visualStyleKeywords ?? [],
    creativeDoList: dna.creativeDoList ?? [],
    creativeDontList: dna.creativeDontList ?? [],
    preferredHooks: dna.preferredHooks ?? [],
    avoidedHooks: dna.avoidedHooks ?? [],
    referenceAdUrls: dna.referenceAdUrls ?? [],
    // ── Customer Intelligence (STA-55) ───────────────────────────────────────
    customerReviewsVerbatim: dna.customerReviewsVerbatim ?? [],
    customerPainPoints: dna.customerPainPoints ?? [],
    customerDesiredOutcome: dna.customerDesiredOutcome,
    customerObjections: dna.customerObjections ?? [],
    // ── Campaign Context (STA-55) ────────────────────────────────────────────
    currentCampaignObjective: dna.currentCampaignObjective,
    currentPromotion: dna.currentPromotion,
    seasonalConstraints: dna.seasonalConstraints ?? [],
    legalConstraints: dna.legalConstraints ?? [],
    // ── Scraped assets (STA-63) ─────────────────────────────────────────────
    icons: dna.icons ?? [],
    // ── Enrichment layer (Phase 2) ───────────────────────────────────────────
    reviewsUrl: dna.reviewsUrl,
    customerVocabulary: dna.customerVocabulary,
    requiredWording: dna.requiredWording ?? [],
    customAssets: dna.customAssets ?? [],
    brandBrief: dna.brandBrief ?? "",
    structuredPersonas: dna.structuredPersonas ?? [],
    communicationAngles: dna.communicationAngles,
    // Phase E: unified asset library
    brandAssets: dna.brandAssets ?? [],
    // Products tab (BrandProduct[] stored in brandDnaJson)
    products: dna.products ?? [],
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--sf-bg-primary)" }}>
      <AppNavbar email={session.user?.email} brandId={brand.id} />

      <BrandDnaClient
        brandId={brand.id}
        initialDna={safeDna}
        brandName={brand.name}
      />
    </main>
  );
}
