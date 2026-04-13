// POST /api/brands/[brandId]/inspirations/[inspirationId]/analyze
// Triggers (or re-triggers) Claude analysis for an inspiration image.
// Fetches the image from R2, sends to Claude for InspirationAnalysis extraction,
// then persists the result to the DB.
// Auth required — user must own the brand and have a Claude API key.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClaudeClient, CLAUDE_MODEL } from "@/lib/claude";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";

export const maxDuration = 120;

// InspirationAnalysis schema (spec Section 3.2)
interface InspirationAnalysis {
  layoutType: string;         // "hero_product" | "split" | "grid" | "overlay" | "editorial" | "ugc" | "text_heavy" | "other"
  textPlacement: string;      // "top" | "bottom" | "left" | "right" | "center" | "overlay" | "none"
  textHierarchy: string[];    // ordered text layers: ["headline", "subheadline", "body", "cta"]
  subjectFocus: string;       // "product" | "person" | "lifestyle" | "abstract" | "mixed"
  backgroundType: string;     // "white" | "solid_color" | "gradient" | "lifestyle_photo" | "studio" | "transparent"
  imageDensity: string;       // "minimal" | "balanced" | "busy"
  dominantColors: string[];   // top 3 hex codes
  colorMood: string;          // "warm" | "cool" | "neutral" | "vibrant" | "dark" | "pastel"
  typographyStyle: string;    // "serif" | "sans_serif" | "display" | "handwritten" | "mixed"
  hookAngle: string;          // "transformation" | "social_proof" | "problem_solution" | "curiosity" | "authority" | "urgency" | "benefit_direct" | "lifestyle"
  copyStructure: string;      // "headline_only" | "headline_body" | "headline_body_cta" | "list" | "minimal" | "story"
  estimatedWordCount: number; // approximate word count visible in the ad
  adFormat: string;           // "1:1" | "4:5" | "9:16" | "1.91:1" | "other"
  productCategory: string;    // "skincare" | "food" | "fashion" | "tech" | "fitness" | "beauty" | "health" | "home" | "pet" | "other"
  mood: string;               // "energetic" | "calm" | "luxurious" | "playful" | "professional" | "emotional" | "aspirational"
  analysisQualityScore: number; // 0.0–1.0 confidence in the analysis
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; inspirationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId, inspirationId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const inspiration = await prisma.inspiration.findFirst({
    where: { id: inspirationId, brandId },
  });
  if (!inspiration) {
    return NextResponse.json({ error: "Inspiration not found" }, { status: 404 });
  }

  if (!inspiration.imageUrl) {
    return NextResponse.json({ error: "Inspiration image not yet uploaded" }, { status: 422 });
  }

  // Get user's Claude API key (BYOK)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicApiKey: true },
  });
  const anthropicApiKey = user?.anthropicApiKey ?? undefined;

  const claude = createClaudeClient(anthropicApiKey);

  // Fetch image from R2 (or public URL) to send as base64 to Claude
  let imageBase64: string;
  let imageMime: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg";

  try {
    const response = await fetch(inspiration.imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuf = await response.arrayBuffer();
    imageBase64 = Buffer.from(arrayBuf).toString("base64");
    const ct = response.headers.get("content-type") ?? "";
    if (ct.includes("png")) imageMime = "image/png";
    else if (ct.includes("webp")) imageMime = "image/webp";
    else imageMime = "image/jpeg";
  } catch (err) {
    console.error("[inspirations/analyze] Failed to fetch image:", err);
    return NextResponse.json(
      { error: "image_fetch_failed", message: "Could not retrieve the inspiration image for analysis." },
      { status: 502 }
    );
  }

  const prompt = `You are an expert ad creative analyst. Analyze this Meta ad creative image and extract structured data.

Return ONLY a valid JSON object (no markdown, no prose) with these exact fields:

{
  "layoutType": one of ["hero_product","split","grid","overlay","editorial","ugc","text_heavy","other"],
  "textPlacement": one of ["top","bottom","left","right","center","overlay","none"],
  "textHierarchy": ordered array of text layers visible, e.g. ["headline","subheadline","cta"],
  "subjectFocus": one of ["product","person","lifestyle","abstract","mixed"],
  "backgroundType": one of ["white","solid_color","gradient","lifestyle_photo","studio","transparent"],
  "imageDensity": one of ["minimal","balanced","busy"],
  "dominantColors": array of top 3 hex codes (e.g. ["#FF5733","#FFFFFF","#1A1A1A"]),
  "colorMood": one of ["warm","cool","neutral","vibrant","dark","pastel"],
  "typographyStyle": one of ["serif","sans_serif","display","handwritten","mixed"],
  "hookAngle": one of ["transformation","social_proof","problem_solution","curiosity","authority","urgency","benefit_direct","lifestyle"],
  "copyStructure": one of ["headline_only","headline_body","headline_body_cta","list","minimal","story"],
  "estimatedWordCount": integer,
  "adFormat": one of ["1:1","4:5","9:16","1.91:1","other"],
  "productCategory": one of ["skincare","food","fashion","tech","fitness","beauty","health","home","pet","other"],
  "mood": one of ["energetic","calm","luxurious","playful","professional","emotional","aspirational"],
  "analysisQualityScore": float 0.0–1.0 (confidence in your analysis)
}

Rules:
- Return ONLY valid JSON
- analysisQualityScore should reflect image clarity and how confidently you can analyze it (0.7+ = clear ad, 0.4–0.7 = partially visible, <0.4 = unclear)
- For textHierarchy, use what is visually present, in order of visual prominence`;

  let analysis: InspirationAnalysis;
  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: imageMime, data: imageBase64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const text = (response.content.find((b) => b.type === "text") as TextBlock | undefined)?.text ?? "";
    const json = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    analysis = JSON.parse(json);
  } catch (err) {
    console.error("[inspirations/analyze] Claude analysis failed:", err);
    return NextResponse.json(
      { error: "analysis_failed", message: "Claude analysis failed. Try again." },
      { status: 422 }
    );
  }

  // Persist analysis result
  const updated = await prisma.inspiration.update({
    where: { id: inspirationId },
    data: {
      analysisJson: analysis as object,
      analyzedAt: new Date(),
    },
  });

  return NextResponse.json({ inspiration: updated, analysis });
}
