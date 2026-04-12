// POST /api/creatives/generate
// Generates an ad creative: Claude brief → Gemini image → QA → saved to DB
// Auth required

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCreative } from "@/lib/image-generator";
import { qaReviewCreative } from "@/lib/qa-reviewer";
import { findMatchingTemplates } from "@/lib/template-matcher";
import type { AdFormat, CreativeAngle } from "@/types/index";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let brandId: string, format: AdFormat, angle: CreativeAngle;
  try {
    ({ brandId, format = "1080x1080", angle = "benefit" } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  // Verify user owns this brand
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Get user's BYOK keys
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicApiKey: true, geminiApiKey: true },
  });

  // Create creative record in GENERATING state
  const creative = await prisma.creative.create({
    data: {
      brandId,
      format,
      angle,
      status: "GENERATING",
      briefJson: {},
    },
  });

  try {
    const brandDna = brand.brandDnaJson as unknown as Parameters<typeof generateCreative>[0];

    // Fetch BDD inspiration templates (SPECS.md §4.1 step 3 — STA-58)
    // Graceful degradation: if BDD is empty, generation continues without templates
    const inspirationTemplates = await findMatchingTemplates(brandDna, angle, format);

    // Step 1 + 2: Claude brief → Gemini image (with BDD inspiration)
    const generated = await generateCreative(
      brandDna,
      format,
      angle,
      session.user.id,
      brandId,
      creative.id,
      {
        anthropicApiKey: user?.anthropicApiKey ?? undefined,
        geminiApiKey: user?.geminiApiKey ?? undefined,
        inspirationTemplates,
      }
    );

    // Step 3: QA review loop (Claude reviews, Gemini regenerates if score < 0.7)
    const qaResult = await qaReviewCreative(
      generated,
      brandDna,
      user?.anthropicApiKey ?? undefined,
      user?.geminiApiKey ?? undefined,
      session.user.id,
      brandId,
      creative.id
    );

    // Update creative record with results
    const updated = await prisma.creative.update({
      where: { id: creative.id },
      data: {
        imageUrl: qaResult.imageUrl,
        briefJson: generated.brief as object,
        status: qaResult.approved ? "APPROVED" : "QA_REVIEW",
        score: qaResult.score,
      },
    });

    return NextResponse.json({ creative: updated, qaResult }, { status: 201 });
  } catch (err) {
    // Mark creative as rejected if generation fails
    await prisma.creative.update({
      where: { id: creative.id },
      data: { status: "REJECTED" },
    });

    console.error("[creatives/generate]", err);
    return NextResponse.json(
      { error: "Creative generation failed. Check your API keys and try again." },
      { status: 500 }
    );
  }
}
