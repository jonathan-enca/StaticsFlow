// POST /api/creatives/generate
// Generates an ad creative: Claude brief → Gemini image → QA → saved to DB
// Optional: variants:true → generates 3 creatives (A: requested angle, B: Claude-picked, C: social_proof)
// Auth required

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCreative } from "@/lib/image-generator";
import { qaReviewCreative } from "@/lib/qa-reviewer";
import { findMatchingTemplates } from "@/lib/template-matcher";
import type { AdFormat, CreativeAngle, ImageQuality } from "@/types/index";

// Extend Vercel function timeout — generation pipeline (Claude + Gemini + QA) can take 60-120s.
// Vercel Pro allows up to 300s; default 10s would cause silent timeouts.
export const maxDuration = 300;

// Deterministic "next best angle" map — used for variant B when Claude doesn't pick
const NEXT_ANGLE: Record<CreativeAngle, CreativeAngle> = {
  benefit: "pain",
  pain: "benefit",
  social_proof: "benefit",
  curiosity: "benefit",
  fomo: "urgency",
  authority: "social_proof",
  urgency: "fomo",
};

interface InspirationSource {
  type: "template" | "url" | "upload";
  imageUrl: string | null;
  label: string;
}

async function generateOne(
  brandDna: Parameters<typeof generateCreative>[0],
  format: AdFormat,
  angle: CreativeAngle,
  userId: string,
  brandId: string,
  anthropicApiKey?: string,
  geminiApiKey?: string,
  imageQuality?: ImageQuality,
  creativeBrief?: string,
  referenceImageUrl?: string, // "From example" mode via URL — skips BDD template lookup
  referenceImageData?: { data: string; mimeType: string } // "From example" mode via drag-and-drop
) {
  const creative = await prisma.creative.create({
    data: { brandId, format, angle, status: "GENERATING", briefJson: {} },
  });

  try {
    // In "from example" mode, skip BDD matching entirely — reference image is passed directly
    const hasReference = !!(referenceImageUrl || referenceImageData);
    const inspirationTemplates = hasReference
      ? undefined
      : await findMatchingTemplates(brandDna, angle, format);

    // Build inspirationSource for the response so the client can show "Inspired by…"
    let inspirationSource: InspirationSource | undefined;
    if (referenceImageUrl) {
      inspirationSource = { type: "url", imageUrl: referenceImageUrl, label: "Your reference image" };
    } else if (referenceImageData) {
      inspirationSource = { type: "upload", imageUrl: null, label: "Your uploaded image" };
    } else if (inspirationTemplates && inspirationTemplates.length > 0) {
      const tpl = inspirationTemplates[0];
      inspirationSource = {
        type: "template",
        imageUrl: tpl.thumbnailUrl ?? tpl.sourceImageUrl,
        label: `BDD Template — ${tpl.category}`,
      };
    }

    const generated = await generateCreative(
      brandDna,
      format,
      angle,
      userId,
      brandId,
      creative.id,
      { anthropicApiKey, geminiApiKey, inspirationTemplates, imageQuality, creativeBrief, referenceImageUrl, referenceImageData }
    );
    const qaResult = await qaReviewCreative(
      generated,
      brandDna,
      anthropicApiKey,
      geminiApiKey,
      userId,
      brandId,
      creative.id,
      2,
      imageQuality
    );
    const updated = await prisma.creative.update({
      where: { id: creative.id },
      data: {
        imageUrl: qaResult.imageUrl,
        briefJson: generated.brief as object,
        status: qaResult.approved ? "APPROVED" : "QA_REVIEW",
        score: qaResult.score,
      },
    });
    return { creative: updated, qaResult, inspirationSource };
  } catch (err) {
    await prisma.creative.update({
      where: { id: creative.id },
      data: { status: "REJECTED" },
    });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let brandId: string, format: AdFormat, angle: CreativeAngle, variants: boolean, imageQuality: ImageQuality, creativeBrief: string | undefined, referenceImageUrl: string | undefined, referenceImageData: { data: string; mimeType: string } | undefined;
  try {
    ({
      brandId,
      format = "1080x1080",
      angle = "benefit",
      variants = false,
      imageQuality = "flash",
      creativeBrief = undefined,
      referenceImageUrl = undefined,
      referenceImageData = undefined,
    } = await req.json());
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

  const brandDna = brand.brandDnaJson as unknown as Parameters<typeof generateCreative>[0];
  const anthropicKey = user?.anthropicApiKey ?? undefined;
  const geminiKey = user?.geminiApiKey ?? undefined;

  // Guard: require both BYOK keys before attempting generation.
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "Claude (Anthropic) API key is not set. Go to Settings → API Keys to add it." },
      { status: 400 }
    );
  }
  if (!geminiKey) {
    return NextResponse.json(
      { error: "Gemini (Google) API key is not set. Go to Settings → API Keys to add it." },
      { status: 400 }
    );
  }

  if (!variants) {
    // Single creative (original behaviour)
    const singleUserId = session.user.id as string;
    try {
      const result = await generateOne(
        brandDna,
        format,
        angle,
        singleUserId,
        brandId,
        anthropicKey,
        geminiKey,
        imageQuality,
        creativeBrief,
        referenceImageUrl,
        referenceImageData
      );
      return NextResponse.json({ creative: result.creative, qaResult: result.qaResult, inspirationSource: result.inspirationSource }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[creatives/generate]", err);
      return NextResponse.json(
        { error: `Creative generation failed: ${message}` },
        { status: 500 }
      );
    }
  }

  // Variants mode: generate A (requested), B (next best), C (social_proof) in parallel
  const angleB: CreativeAngle =
    angle !== "social_proof" ? NEXT_ANGLE[angle] : "benefit";
  const angleC: CreativeAngle = "social_proof";

  const variantAngles: CreativeAngle[] = [
    angle,
    angleB !== angle ? angleB : "curiosity",
    angle !== angleC ? angleC : "fomo",
  ];

  const userId = session.user.id as string;
  const results = await Promise.allSettled(
    variantAngles.map((a) =>
      generateOne(brandDna, format, a, userId, brandId, anthropicKey, geminiKey, imageQuality, creativeBrief, referenceImageUrl, referenceImageData)
    )
  );

  const successfulVariants = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof generateOne>>> => r.status === "fulfilled")
    .map((r) => r.value);

  if (successfulVariants.length === 0) {
    const firstFailure = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    const message = firstFailure?.reason instanceof Error
      ? firstFailure.reason.message
      : "All variant generations failed";
    return NextResponse.json(
      { error: `Creative generation failed: ${message}` },
      { status: 500 }
    );
  }

  // Share the inspirationSource (same across all variants since mode is consistent)
  const inspirationSource = successfulVariants[0]?.inspirationSource;
  return NextResponse.json({ variants: successfulVariants, inspirationSource }, { status: 201 });
}
