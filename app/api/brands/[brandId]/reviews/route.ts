// POST /api/brands/[brandId]/reviews
// Triggers Claude extraction of customer vocabulary from a reviews URL.
// Stores the result in brandDnaJson.customerVocabulary + reviewsUrl.
// Auth required — user must own the brand and have a Claude API key.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractCustomerVocabulary } from "@/lib/brand-dna-extractor";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  // Verify ownership and get brand
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let reviewsUrl: string;
  try {
    ({ reviewsUrl } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!reviewsUrl || typeof reviewsUrl !== "string") {
    return NextResponse.json({ error: "reviewsUrl is required" }, { status: 400 });
  }

  // Normalize URL
  const normalized = reviewsUrl.startsWith("http") ? reviewsUrl : `https://${reviewsUrl}`;
  try { new URL(normalized); } catch {
    return NextResponse.json({ error: "Invalid reviews URL" }, { status: 400 });
  }

  // Get user's BYOK Claude key
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicApiKey: true },
  });

  const existingDna = (brand.brandDnaJson ?? {}) as Partial<ExtractedBrandDNA>;
  const brandName = existingDna.name ?? brand.name;

  try {
    const customerVocabulary = await extractCustomerVocabulary(
      normalized,
      brandName,
      user?.anthropicApiKey ?? undefined
    );

    // Merge into brandDnaJson
    const merged = {
      ...existingDna,
      reviewsUrl: normalized,
      customerVocabulary,
    };

    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: { brandDnaJson: merged as object },
    });

    return NextResponse.json({ brand: updated, customerVocabulary }, { status: 200 });
  } catch (err) {
    console.error("[brands/reviews]", err);
    return NextResponse.json(
      {
        error:
          "Failed to extract customer vocabulary. Check that the reviews URL is accessible and your Claude API key is valid.",
      },
      { status: 500 }
    );
  }
}
