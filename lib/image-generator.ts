// Gemini image generation pipeline (STA-13)
// Takes a creative brief from Claude and generates the ad image via Gemini
// Gemini is THE ONLY image model — no fallback (SPECS.md §1.5)

import { createGeminiClient, GEMINI_IMAGE_MODEL } from "@/lib/gemini";
import { createClaudeClient, CLAUDE_MODEL } from "@/lib/claude";
import { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import { uploadToR2, creativeKey } from "@/lib/r2";
import type { AdFormat, CreativeAngle } from "@/types/index";

export interface CreativeBrief {
  headline: string;
  subheadline: string;
  copy: string;
  callToAction: string;
  angle: CreativeAngle;
  format: AdFormat;
  layout: string;
  colorGuidance: string;
  fontGuidance: string;
  imagePrompt: string; // The Gemini image generation prompt
  brandDnaRef: ExtractedBrandDNA;
}

export interface GeneratedCreative {
  brief: CreativeBrief;
  imageUrl: string; // R2 public URL
  imageBase64?: string; // Returned when R2 is not configured
}

/**
 * Step 1: Claude generates a creative brief from Brand DNA.
 * Step 2: Gemini generates the image from the brief.
 * Step 3: Image is uploaded to R2 and the URL is returned.
 */
export async function generateCreative(
  brandDna: ExtractedBrandDNA,
  format: AdFormat = "1080x1080",
  angle: CreativeAngle = "benefit",
  userId: string,
  brandId: string,
  creativeId: string,
  anthropicApiKey?: string,
  geminiApiKey?: string
): Promise<GeneratedCreative> {
  // Step 1: Generate the creative brief via Claude
  const brief = await generateCreativeBrief(
    brandDna,
    format,
    angle,
    anthropicApiKey
  );

  // Step 2: Generate the image via Gemini
  const imageData = await generateImageWithGemini(brief, geminiApiKey);

  // Step 3: Upload to R2 (skip if R2 not configured in dev)
  let imageUrl: string;
  let imageBase64: string | undefined;

  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCOUNT_ID !== "YOUR_CLOUDFLARE_ACCOUNT_ID") {
    const key = creativeKey(userId, brandId, creativeId);
    const buffer = Buffer.from(imageData, "base64");
    imageUrl = await uploadToR2(key, buffer, "image/png");
  } else {
    // Dev fallback: store full data URL so the image is displayable without R2
    imageBase64 = imageData;
    imageUrl = `data:image/png;base64,${imageData}`;
    console.warn("[image-generator] R2 not configured — image stored as data URL (dev only)");
  }

  return { brief, imageUrl, imageBase64 };
}

/**
 * Regenerate just the image with QA feedback appended to the original prompt.
 * Used by the QA loop on iteration 2 when score < 0.7.
 */
export async function regenerateImageWithFeedback(
  previous: GeneratedCreative,
  feedback: string,
  userId?: string,
  brandId?: string,
  creativeId?: string,
  geminiApiKey?: string
): Promise<GeneratedCreative> {
  const enhancedPrompt = `${previous.brief.imagePrompt}\n\nQA FEEDBACK TO ADDRESS: ${feedback}`;
  const enhancedBrief = { ...previous.brief, imagePrompt: enhancedPrompt };

  const imageData = await generateImageWithGemini(enhancedBrief, geminiApiKey);

  let imageUrl: string;
  let imageBase64: string | undefined;

  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCOUNT_ID !== "YOUR_CLOUDFLARE_ACCOUNT_ID" &&
    userId && brandId && creativeId
  ) {
    const key = creativeKey(userId, brandId, `${creativeId}_v2`);
    const buffer = Buffer.from(imageData, "base64");
    imageUrl = await uploadToR2(key, buffer, "image/png");
  } else {
    imageBase64 = imageData;
    imageUrl = `data:image/png;base64,${imageData}`;
  }

  return { brief: enhancedBrief, imageUrl, imageBase64 };
}

/**
 * Claude generates a structured creative brief calibrated to the Brand DNA.
 * This is the "Creative Briefing" step (SPECS.md §4.1 step 4).
 */
async function generateCreativeBrief(
  brandDna: ExtractedBrandDNA,
  format: AdFormat,
  angle: CreativeAngle,
  apiKey?: string
): Promise<CreativeBrief> {
  const client = createClaudeClient(apiKey);

  const [width, height] = format.split("x").map(Number);
  const isPortrait = height > width;
  const isLandscape = width > height;

  // Build enrichment context (empty strings when not set — no undefined in prompt)
  const customerVocab = brandDna.customerVocabulary;
  const vocabSection = customerVocab
    ? `
CUSTOMER VOCABULARY (real words your customers use — mirror this language in copy):
- Verbatims: ${customerVocab.verbatims.slice(0, 5).join(" | ")}
- Recurring words: ${customerVocab.recurringWords.join(", ")}
- Emotional words: ${customerVocab.emotionalWords.join(", ")}`
    : "";

  const requiredWording = brandDna.requiredWording?.length
    ? `\n- Required wording (MUST include): ${brandDna.requiredWording.join(", ")}`
    : "";

  const brandBriefSection = brandDna.brandBrief
    ? `\n- Brand charter: ${brandDna.brandBrief}`
    : "";

  const structuredPersonasSection = brandDna.structuredPersonas?.length
    ? `\n- Detailed personas: ${brandDna.structuredPersonas
        .map(
          (p) =>
            `${p.name} (${p.ageRange}): pain points=${p.painPoints.join(", ")}; aspirations=${p.aspirations.join(", ")}`
        )
        .join(" | ")}`
    : "";

  const anglesSection = brandDna.communicationAngles
    ? `\n- Preferred angles: ${brandDna.communicationAngles.preferred.join(", ")}` +
      `\n- FORBIDDEN angles: ${brandDna.communicationAngles.forbidden.join(", ")}`
    : "";

  const customAssetsSection =
    brandDna.customAssets?.length
      ? `\n- Custom brand assets available: ${brandDna.customAssets.map((a) => `${a.type} (${a.url})`).join(", ")}`
      : "";

  const prompt = `You are a senior creative director at a top DTC advertising agency. Create a detailed creative brief for a static Meta Ad that is unmistakably "on brand" for this brand.

BRAND DNA:
- Brand: ${brandDna.name}
- Website: ${brandDna.url}
- Category: ${brandDna.productCategory}
- Tone of Voice: ${brandDna.toneOfVoice}
- Brand Voice: ${brandDna.brandVoice}
- Key Benefits: ${brandDna.keyBenefits?.join(", ") ?? ""}
- Personas: ${brandDna.personas?.join(" | ") ?? ""}${structuredPersonasSection}
- Primary Color: ${brandDna.colors.primary}
- Secondary Color: ${brandDna.colors.secondary}
- Accent Color: ${brandDna.colors.accent}
- Fonts: ${brandDna.fonts?.join(", ") ?? ""}
- Forbidden Words: ${brandDna.forbiddenWords?.join(", ") ?? ""}${requiredWording}${brandBriefSection}${anglesSection}${customAssetsSection}${vocabSection}

AD PARAMETERS:
- Format: ${format} (${isPortrait ? "vertical portrait" : isLandscape ? "horizontal landscape" : "square"})
- Hook angle: ${angle}
- Language: ${brandDna.language}

Return ONLY a valid JSON object with this exact structure:

{
  "headline": "The main headline (max 6 words, punchy, uses the ${angle} angle)",
  "subheadline": "Supporting line (max 12 words)",
  "copy": "Body copy (max 20 words, ${brandDna.toneOfVoice} tone)",
  "callToAction": "CTA button text (2-4 words)",
  "angle": "${angle}",
  "format": "${format}",
  "layout": "Describe the visual layout: e.g., 'Product hero center, headline top-left, CTA bottom-right'",
  "colorGuidance": "Exact color usage: primary ${brandDna.colors.primary} for background, accent ${brandDna.colors.accent} for CTA button",
  "fontGuidance": "Font hierarchy: ${brandDna.fonts?.[0] ?? "sans-serif"} for headline bold, same regular for body",
  "imagePrompt": "A detailed image generation prompt for Gemini that describes EXACTLY what the ad should look like visually. Include: exact layout, product placement, background color (${brandDna.colors.primary}), text positions, visual style. The ad must look like it was made by the brand's in-house design team, not a generic AI tool. Make it specific to ${brandDna.productCategory}. Format: ${format}. Style: photorealistic, professional ad quality, no watermarks, no generic stock photo feel."
}`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Omit<CreativeBrief, "brandDnaRef">;
  return { ...parsed, brandDnaRef: brandDna };
}

/**
 * Gemini generates the ad image from the creative brief.
 * This is THE ONLY image generation model (SPECS.md §1.5 §4.1 step 5).
 */
async function generateImageWithGemini(
  brief: CreativeBrief,
  apiKey?: string
): Promise<string> {
  const client = createGeminiClient(apiKey);
  const model = client.getGenerativeModel({ model: GEMINI_IMAGE_MODEL });

  // responseModalities is required for image generation but not yet in SDK types.
  // Must use uppercase "IMAGE" and include "TEXT" as Gemini returns both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: brief.imagePrompt }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] } as any,
  } as any);

  const candidate = response.response.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  // Extract base64 image data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = (candidate.content?.parts ?? []) as any[];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    throw new Error("Gemini response did not contain an image");
  }

  return imagePart.inlineData.data as string;
}
