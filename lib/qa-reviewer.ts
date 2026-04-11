// QA Loop: Claude reviews each generated creative for brand consistency
// Max 2 iterations before returning the best result (SPECS.md §4.1 step 6)

import { createClaudeClient, CLAUDE_QA_MODEL } from "@/lib/claude";
import { regenerateImageWithFeedback } from "@/lib/image-generator";
import type { GeneratedCreative } from "@/lib/image-generator";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";

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
  maxIterations = 2
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
        geminiApiKey
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

  const prompt = `You are a senior creative director reviewing an AI-generated ad creative for brand consistency and quality. Be STRICT — generic or off-brand creatives are failures.

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

EVALUATION CRITERIA:
1. Brand consistency: Does the copy match the tone of voice? Are forbidden words absent?
2. Copy quality: Is the headline punchy and on-angle? Is the copy compelling?
3. Strategic alignment: Does this creative address the target personas?
4. "On brand" score: Would this look like it was made by ${brandDna.name}'s in-house team?

Return ONLY a valid JSON object:
{
  "score": 0.0 to 1.0 (0.7+ = approved),
  "approved": true or false,
  "feedback": "One concise sentence summarizing the overall quality",
  "brandConsistency": "Assessment of brand alignment",
  "textQuality": "Assessment of copy quality",
  "visualQuality": "Assessment of layout/visual concept",
  "improvements": ["Specific improvement 1 if score < 0.7", "Improvement 2"]
}

Be rigorous. A score of 0.9+ means this looks like premium agency work for this specific brand. Generic = 0.4 or below.`;

  const response = await client.messages.create({
    model: CLAUDE_QA_MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  return JSON.parse(cleaned) as QAReviewResponse;
}
