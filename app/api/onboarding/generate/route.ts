// POST /api/onboarding/generate
// Guest-friendly creative generation for the onboarding flow.
// No auth required. API keys passed inline (BYOK model — SPECS.md §7.3).
// No DB writes — this is a preview. User creates an account after seeing the creative.

import { NextRequest, NextResponse } from "next/server";
import { generateCreative } from "@/lib/image-generator";
import { qaReviewCreative } from "@/lib/qa-reviewer";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { AdFormat, CreativeAngle } from "@/types/index";

export async function POST(req: NextRequest) {
  let dna: ExtractedBrandDNA;
  let anthropicApiKey: string | undefined;
  let geminiApiKey: string | undefined;
  let format: AdFormat;
  let angle: CreativeAngle;

  try {
    const body = await req.json();
    dna = body.dna;
    anthropicApiKey = body.anthropicApiKey || undefined;
    geminiApiKey = body.geminiApiKey || undefined;
    format = body.format ?? "1080x1080";
    angle = body.angle ?? "benefit";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!dna || typeof dna !== "object") {
    return NextResponse.json({ error: "dna is required" }, { status: 400 });
  }

  try {
    // Run the full pipeline: Claude brief → Gemini image → QA
    // Using guest IDs since this is a no-auth preview
    const generated = await generateCreative(
      dna,
      format,
      angle,
      "guest",
      "guest",
      "onboarding-preview",
      { anthropicApiKey, geminiApiKey }
    );

    const qaResult = await qaReviewCreative(generated, dna, anthropicApiKey);

    return NextResponse.json(
      {
        creative: {
          id: "preview",
          imageUrl: generated.imageBase64
            ? `data:image/png;base64,${generated.imageBase64}`
            : generated.imageUrl,
          briefJson: generated.brief,
          status: qaResult.approved ? "APPROVED" : "QA_REVIEW",
          score: qaResult.score,
        },
        qaResult,
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Creative generation failed";
    console.error("[onboarding/generate] error:", message, err);

    const isKeyError =
      message.toLowerCase().includes("api key") ||
      message.toLowerCase().includes("authentication") ||
      message.toLowerCase().includes("401") ||
      message.toLowerCase().includes("permission") ||
      message.toLowerCase().includes("403");

    return NextResponse.json(
      {
        error: isKeyError
          ? "Invalid API key. Please check your Claude and Gemini API keys."
          : "Creative generation failed. Please try again.",
        // Include root cause in dev to help debugging
        ...(process.env.NODE_ENV !== "production" && { detail: message }),
      },
      { status: 500 }
    );
  }
}
