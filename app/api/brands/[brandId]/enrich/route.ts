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
  // Auto-extracted fields (editable by user)
  colors?: { primary: string; secondary: string; accent: string };
  fonts?: string[];
  logoUrl?: string | null;
  toneOfVoice?: string;
  brandVoice?: string;
  keyBenefits?: string[];
  personas?: string[];
  productImages?: string[];
  lifestyleImages?: string[];
  // Manual enrichment fields
  forbiddenWords?: string[];
  requiredWording?: string[];
  brandBrief?: string;
  structuredPersonas?: Persona[];
  communicationAngles?: CommunicationAngles;
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
  const merged: Partial<ExtractedBrandDNA> = {
    ...existingDna,
    // Auto-extracted (user-editable overrides)
    ...(payload.colors !== undefined && { colors: payload.colors }),
    ...(payload.fonts !== undefined && { fonts: payload.fonts }),
    ...(payload.logoUrl !== undefined && { logoUrl: payload.logoUrl }),
    ...(payload.toneOfVoice !== undefined && { toneOfVoice: payload.toneOfVoice }),
    ...(payload.brandVoice !== undefined && { brandVoice: payload.brandVoice }),
    ...(payload.keyBenefits !== undefined && { keyBenefits: payload.keyBenefits }),
    ...(payload.personas !== undefined && { personas: payload.personas }),
    ...(payload.productImages !== undefined && { productImages: payload.productImages }),
    ...(payload.lifestyleImages !== undefined && { lifestyleImages: payload.lifestyleImages }),
    // Manual enrichment
    ...(payload.forbiddenWords !== undefined && { forbiddenWords: payload.forbiddenWords }),
    ...(payload.requiredWording !== undefined && { requiredWording: payload.requiredWording }),
    ...(payload.brandBrief !== undefined && { brandBrief: payload.brandBrief }),
    ...(payload.structuredPersonas !== undefined && { structuredPersonas: payload.structuredPersonas }),
    ...(payload.communicationAngles !== undefined && { communicationAngles: payload.communicationAngles }),
  };

  const updated = await prisma.brand.update({
    where: { id: brandId },
    data: { brandDnaJson: merged as object },
  });

  return NextResponse.json({ brand: updated }, { status: 200 });
}
