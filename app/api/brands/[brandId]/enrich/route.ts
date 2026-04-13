// PUT /api/brands/[brandId]/enrich
// Merges manual enrichment fields into the brand's brandDnaJson.
// Accepts: forbiddenWords, requiredWording, brandBrief, structuredPersonas, communicationAngles
// Auth required — user must own the brand.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { Persona, CommunicationAngles } from "@/types/index";

interface EnrichPayload {
  // Visuals & Identity
  colors?: { primary: string; secondary: string; accent: string };
  fonts?: string[];
  logoUrl?: string | null;
  productImages?: string[];
  lifestyleImages?: string[];
  // Identity & Positioning
  brandArchetype?: string;
  pricePositioning?: string;
  targetMarkets?: string[];
  // competitorBrands removed (STA-79) — had zero impact on generation outputs
  differentiators?: string[];
  productCategory?: string;
  keyBenefits?: string[];
  personas?: string[];
  // Voice & Messaging
  toneOfVoice?: string;
  brandVoice?: string;
  brandVoiceAdjectives?: string[];
  forbiddenWords?: string[];
  mandatoryMentions?: string[];
  requiredWording?: string[];
  messagingHierarchy?: string[];
  callToActionExamples?: string[];
  // Creative Direction
  visualStyleKeywords?: string[];
  // moodboardUrls removed (STA-79) — moved to Product.moodboardAssets (drag-and-drop upload)
  creativeDoList?: string[];
  creativeDontList?: string[];
  preferredHooks?: string[];
  avoidedHooks?: string[];
  referenceAdUrls?: string[];
  // Customer Intelligence
  customerReviewsVerbatim?: string[];
  customerPainPoints?: string[];
  customerDesiredOutcome?: string;
  customerObjections?: string[];
  // Campaign Context
  currentCampaignObjective?: string;
  currentPromotion?: string;
  seasonalConstraints?: string[];
  legalConstraints?: string[];
  // Manual enrichment
  brandBrief?: string;
  structuredPersonas?: Persona[];
  communicationAngles?: CommunicationAngles;
  // Scraped assets
  icons?: string[];
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  // Verify ownership
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let payload: EnrichPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Merge enrichment fields into existing DNA (non-destructive — only update provided fields)
  const existingDna = (brand.brandDnaJson ?? {}) as Partial<ExtractedBrandDNA>;

  // Helper to only spread if field is present in payload
  const pick = <K extends keyof typeof payload>(key: K) =>
    payload[key] !== undefined ? { [key]: payload[key] } : {};

  const merged: Partial<ExtractedBrandDNA> = {
    ...existingDna,
    // Visuals & Identity
    ...pick("colors"),
    ...pick("fonts"),
    ...pick("logoUrl"),
    ...pick("productImages"),
    ...pick("lifestyleImages"),
    // Identity & Positioning
    ...pick("brandArchetype"),
    ...pick("pricePositioning"),
    ...pick("targetMarkets"),
    ...pick("differentiators"),
    ...pick("productCategory"),
    ...pick("keyBenefits"),
    ...pick("personas"),
    // Voice & Messaging
    ...pick("toneOfVoice"),
    ...pick("brandVoice"),
    ...pick("brandVoiceAdjectives"),
    ...pick("forbiddenWords"),
    ...pick("mandatoryMentions"),
    ...pick("requiredWording"),
    ...pick("messagingHierarchy"),
    ...pick("callToActionExamples"),
    // Creative Direction
    ...pick("visualStyleKeywords"),
    ...pick("creativeDoList"),
    ...pick("creativeDontList"),
    ...pick("preferredHooks"),
    ...pick("avoidedHooks"),
    ...pick("referenceAdUrls"),
    // Customer Intelligence
    ...pick("customerReviewsVerbatim"),
    ...pick("customerPainPoints"),
    ...pick("customerDesiredOutcome"),
    ...pick("customerObjections"),
    // Campaign Context
    ...pick("currentCampaignObjective"),
    ...pick("currentPromotion"),
    ...pick("seasonalConstraints"),
    ...pick("legalConstraints"),
    // Manual enrichment
    ...pick("brandBrief"),
    ...pick("structuredPersonas"),
    ...pick("communicationAngles"),
    // Scraped assets
    ...pick("icons"),
  } as Partial<ExtractedBrandDNA>;

  const updated = await prisma.brand.update({
    where: { id: brandId },
    data: { brandDnaJson: merged as object },
  });

  return NextResponse.json({ brand: updated }, { status: 200 });
}
