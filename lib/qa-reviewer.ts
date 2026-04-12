// QA Loop: Claude reviews each generated creative for brand consistency
// Max 2 iterations before returning the best result (SPECS.md §4.1 step 6)

import { createClaudeClient, CLAUDE_QA_MODEL } from "@/lib/claude";
import { regenerateImageWithFeedback } from "@/lib/image-generator";
import type { GeneratedCreative } from "@/lib/image-generator";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { ImageQuality } from "@/types/index";

export interface QAResult {
  approved: boolean;
  score: number; // 0–1
  feedback: string;
  imageUrl: string;
  iterations: number;
}

/**
 * Claude QA review of a generated creative.
 * If quality is insufficient (score < 0.7), triggers one regeneration with feedback.
 * Returns the best result after max 2 attempts.
 */
export async function qaReviewCreative(
  creative: GeneratedCreative,
  brandDna: ExtractedBrandDNA,
  anthropicApiKey?: string,
  geminiApiKey?: string,
  userId?: string,
  brandId?: string,
  creativeId?: string,
  maxIterations = 2,
  imageQuality?: ImageQuality
): Promise<QAResult> {
  let currentCreative = creative;
  let iteration = 0;
  let lastResult: QAReviewResponse | null = null;

  while (iteration < maxIterations) {
    iteration++;
    lastResult = await runQAReview(currentCreative, brandDna, anthropicApiKey);

    if (lastResult.score >= 0.7) {
      // Quality threshold met — approve
      break;
    }

    if (iteration < maxIterations) {
      // Regenerate with QA feedback incorporated into the image prompt
      console.log(`[qa] Iteration ${iteration} score ${lastResult.score} — regenerating with feedback`);
      const improvements = lastResult.improvements.join("; ");
      currentCreative = await regenerateImageWithFeedback(
        currentCreative,
        improvements,
        userId,
        brandId,
        creativeId,
        geminiApiKey,
        imageQuality
      );
    }
  }

  return {
    approved: (lastResult?.score ?? 0) >= 0.7,
    score: lastResult?.score ?? 0,
    feedback: lastResult?.feedback ?? "",
    imageUrl: currentCreative.imageUrl,
    iterations: iteration,
  };
}

interface QAReviewResponse {
  score: number;
  approved: boolean;
  feedback: string;
  brandConsistency: string;
  textQuality: string;
  visualQuality: string;
  improvements: string[];
}

async function runQAReview(
  creative: GeneratedCreative,
  brandDna: ExtractedBrandDNA,
  apiKey?: string
): Promise<QAReviewResponse> {
  const client = createClaudeClient(apiKey);

  // Resolve base64 image data: prefer imageBase64 (dev / inline), fall back to
  // stripping the data URL prefix if imageUrl is a data URL (also dev path).
  let imageBase64: string | undefined = creative.imageBase64;
  if (!imageBase64 && creative.imageUrl.startsWith("data:image/")) {
    imageBase64 = creative.imageUrl.split(",")[1];
  }

  const hasImage = Boolean(imageBase64);

  const textSection = `You are a senior creative director reviewing an AI-generated static Meta Ad. Be STRICT — generic or off-brand creatives are failures.${hasImage ? "\nYou have been given the actual generated image to review alongside the brief." : ""}

BRAND DNA:
- Brand: ${brandDna.name}
- Category: ${brandDna.productCategory}
- Tone of Voice: ${brandDna.toneOfVoice}
- Brand Voice: ${brandDna.brandVoice}
- Primary Color: ${brandDna.colors.primary}
- Key Benefits: ${brandDna.keyBenefits?.join(", ") ?? ""}
- Forbidden Words: ${brandDna.forbiddenWords?.join(", ") ?? ""}

CREATIVE BRIEF:
- Headline: "${creative.brief.headline}"
- Subheadline: "${creative.brief.subheadline}"
- Copy: "${creative.brief.copy}"
- CTA: "${creative.brief.callToAction}"
- Angle: ${creative.brief.angle}
- Format: ${creative.brief.format}
- Layout: ${creative.brief.layout}
- Color Guidance: ${creative.brief.colorGuidance}

EVALUATION CRITERIA:
1. Brand consistency: Does the copy match the tone of voice? Are forbidden words absent?
2. Copy quality: Is the headline punchy and on-angle? Is the copy compelling?
3. Strategic alignment: Does this creative address the target personas?
4. "On brand" score: Would this look like it was made by ${brandDna.name}'s in-house team?${hasImage ? `
5. Visual execution: Does the image match the brief layout? Are brand colors (${brandDna.colors.primary}) used correctly?
6. Text legibility: Is any text in the image readable, correctly spelled, and on-brand?
7. Ad quality: No watermarks, no obvious AI artifacts, professional Meta-ad standard?` : ""}

Be rigorous. A score of 0.9+ means this looks like premium agency work for this specific brand. Generic = 0.4 or below.
Call the submit_qa_review tool with your assessment.`;

  // Build the message content: include the image when available (Claude vision)
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } };

  const content: ContentBlock[] = [];
  if (hasImage) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: imageBase64! },
    });
  }
  content.push({ type: "text", text: textSection });

  // Use tool_use for guaranteed valid JSON — no parsing errors possible.
  const response = await client.messages.create({
    model: CLAUDE_QA_MODEL,
    max_tokens: 800,
    tools: [
      {
        name: "submit_qa_review",
        description: "Submit the QA review result for this ad creative",
        input_schema: {
          type: "object" as const,
          properties: {
            score:            { type: "number",  description: "Quality score 0.0–1.0. 0.7+ = approved. Generic = 0.4 or below." },
            approved:         { type: "boolean", description: "true if score >= 0.7" },
            feedback:         { type: "string",  description: "One concise sentence summarising overall quality" },
            brandConsistency: { type: "string",  description: "Assessment of brand alignment" },
            textQuality:      { type: "string",  description: "Assessment of copy quality" },
            visualQuality:    { type: "string",  description: hasImage ? "Assessment of actual image: layout, colors, legibility, AI artifacts" : "Assessment of layout/visual concept from brief" },
            improvements:     { type: "array", items: { type: "string" }, description: "Specific improvements if score < 0.7" },
          },
          required: ["score", "approved", "feedback", "brandConsistency", "textQuality", "visualQuality", "improvements"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_qa_review" },
    messages: [{ role: "user", content }],
  });

  const toolUseBlock = response.content.find((c) => c.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Claude did not return a QA review via tool_use");
  }
  return toolUseBlock.input as QAReviewResponse;
}
