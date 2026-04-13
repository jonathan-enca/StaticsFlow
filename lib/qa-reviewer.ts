// QA Loop: Claude reviews each generated creative for brand consistency
// Max 2 iterations before returning the best result (SPECS.md §4.1 step 6)
//
// QA criteria (in priority order):
//  1. Brand DNA consistency — tone, forbidden words, colors, required wording
//  2. Copy quality — headline impact, copy clarity, CTA visibility
//  3. Visual execution — layout vs brief, color usage, composition
//  4. Text legibility — any text in image is readable, correctly spelled
//  5. On-brand score — looks like it was made by the brand's internal team
//  6. Meta Ads compliance — would pass Meta's ad review system
//  7. Production readiness — ready to upload to Meta Business Manager today

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
  metaReady: boolean; // true when this creative can be uploaded to Meta Business Manager as-is
}

/**
 * Claude QA review of a generated creative.
 * If quality is insufficient (score < 0.7), triggers one regeneration with feedback.
 * Returns the best result after max 2 attempts.
 *
 * Phase C dual scoring (STA-95):
 * When inspirationImageUrl is provided, composite score = 0.6 × fidelity + 0.4 × brand_consistency.
 * Brand-only mode (no inspiration) uses the single brand consistency score as before.
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
  imageQuality?: ImageQuality,
  inspirationImageUrl?: string // Phase C: if set, enables dual scoring
): Promise<QAResult> {
  // Fetch inspiration image as base64 once (reused across iterations)
  let inspirationBase64: string | undefined;
  if (inspirationImageUrl) {
    try {
      const res = await fetch(inspirationImageUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        inspirationBase64 = Buffer.from(buf).toString("base64");
      }
    } catch {
      // Non-fatal — degrade gracefully to brand-only scoring
      console.warn("[qa] Could not fetch inspiration image for dual scoring");
    }
  }

  let currentCreative = creative;
  let iteration = 0;
  let lastResult: QAReviewResponse | null = null;

  while (iteration < maxIterations) {
    iteration++;
    lastResult = await runQAReview(currentCreative, brandDna, anthropicApiKey, inspirationBase64);

    // Composite score: fidelity (0.6) + brand consistency (0.4) when inspiration present
    const effectiveScore =
      inspirationBase64 &&
      lastResult.fidelityScore !== undefined &&
      lastResult.brandScore !== undefined
        ? 0.6 * lastResult.fidelityScore + 0.4 * lastResult.brandScore
        : lastResult.score;

    if (effectiveScore >= 0.7) {
      // Inject the composite score so the result reflects dual scoring
      lastResult = { ...lastResult, score: effectiveScore };
      break;
    }

    if (iteration < maxIterations) {
      console.log(`[qa] Iteration ${iteration} score ${effectiveScore.toFixed(2)} — regenerating with feedback`);
      const structuredFeedback = buildRegenerationFeedback(lastResult);
      currentCreative = await regenerateImageWithFeedback(
        currentCreative,
        structuredFeedback,
        userId,
        brandId,
        creativeId,
        geminiApiKey,
        imageQuality
      );
    } else {
      // Last iteration — store composite score
      lastResult = { ...lastResult, score: effectiveScore };
    }
  }

  return {
    approved: (lastResult?.score ?? 0) >= 0.7,
    score: lastResult?.score ?? 0,
    feedback: lastResult?.feedback ?? "",
    imageUrl: currentCreative.imageUrl,
    iterations: iteration,
    metaReady: lastResult?.metaReady ?? false,
  };
}

/**
 * Build structured feedback for the Gemini regeneration prompt.
 * Orders visual fixes first (highest impact on Gemini output),
 * then copy/copy-overlay fixes, then brand fixes.
 */
function buildRegenerationFeedback(review: QAReviewResponse): string {
  const sections: string[] = [];

  if (review.visualImprovements.length > 0) {
    sections.push(`VISUAL FIXES: ${review.visualImprovements.join(". ")}`);
  }
  if (review.copyImprovements.length > 0) {
    sections.push(`COPY FIXES: ${review.copyImprovements.join(". ")}`);
  }
  if (review.brandImprovements.length > 0) {
    sections.push(`BRAND ALIGNMENT: ${review.brandImprovements.join(". ")}`);
  }
  if (review.metaComplianceIssues.length > 0) {
    sections.push(`META ADS COMPLIANCE: ${review.metaComplianceIssues.join(". ")}`);
  }

  return sections.join(" | ") || review.improvements.join("; ");
}

interface QAReviewResponse {
  score: number;
  approved: boolean;
  feedback: string;
  brandConsistency: string;
  textQuality: string;
  visualQuality: string;
  metaReady: boolean;
  improvements: string[]; // Combined list for backward compat
  visualImprovements: string[];
  copyImprovements: string[];
  brandImprovements: string[];
  metaComplianceIssues: string[];
  // Phase C dual scoring — only set when inspiration image is provided
  fidelityScore?: number;
  brandScore?: number;
}

async function runQAReview(
  creative: GeneratedCreative,
  brandDna: ExtractedBrandDNA,
  apiKey?: string,
  inspirationBase64?: string
): Promise<QAReviewResponse> {
  const client = createClaudeClient(apiKey);

  // Resolve base64 image data: prefer imageBase64 (dev / inline), fall back to
  // stripping the data URL prefix if imageUrl is a data URL (also dev path).
  let imageBase64: string | undefined = creative.imageBase64;
  if (!imageBase64 && creative.imageUrl.startsWith("data:image/")) {
    imageBase64 = creative.imageUrl.split(",")[1];
  }

  const hasImage = Boolean(imageBase64);
  const hasInspiration = Boolean(inspirationBase64);

  // STA-85 + STA-87: Build additional compliance check block for the QA prompt
  const additionalComplianceSection = (() => {
    const lines: string[] = [];
    if (brandDna.avoidedHooks?.length) {
      lines.push(`- HOOK VIOLATION CHECK (CRITICAL): Forbidden hook types for this brand: ${brandDna.avoidedHooks.join(", ")}. If the creative uses any of them → add "HOOK VIOLATION: [type]" to brandImprovements and reduce score to ≤ 0.4.`);
    }
    if (brandDna.preferredHooks?.length) {
      lines.push(`- HOOK ALIGNMENT: Preferred hook types: ${brandDna.preferredHooks.join(", ")}. If the creative uses none of these → note in brandImprovements.`);
    }
    if (brandDna.legalConstraints?.length) {
      lines.push(`- LEGAL CONSTRAINTS (CRITICAL): Copy must NOT violate any of these: ${brandDna.legalConstraints.join("; ")}. If violated → add "LEGAL VIOLATION: [details]" to metaComplianceIssues and reduce score to ≤ 0.4.`);
    }
    if (brandDna.pricePositioning) {
      const positioningNote: Record<string, string> = {
        budget: "accessible and value-driven — never luxury-sounding",
        "mid-range": "quality + value balanced — neither cheap nor ultra-premium",
        premium: "aspirational and quality-driven — never discount-driven or cheap-sounding",
        "ultra-premium": "ultra-luxurious and exclusive — any mass-market tone is a failure",
      };
      lines.push(`- PRICE POSITIONING CHECK: Brand is "${brandDna.pricePositioning}" (${positioningNote[brandDna.pricePositioning] ?? brandDna.pricePositioning}). Tone mismatch → flag in brandImprovements.`);
    }
    return lines.length > 0
      ? `\n\nADDITIONAL COMPLIANCE CHECKS (score penalties apply):\n${lines.join("\n")}`
      : "";
  })();

  const textSection = `You are a senior creative director and Meta Ads specialist reviewing an AI-generated static Meta Ad. Be STRICT — generic creatives, off-brand creatives, and anything that would fail Meta's ad review are ALL failures.${hasImage ? "\nYou have the actual generated image to review alongside the brief." : ""}

BRAND DNA:
- Brand: ${brandDna.name}
- Category: ${brandDna.productCategory}
- Tone of Voice: ${brandDna.toneOfVoice}
- Brand Voice: ${brandDna.brandVoice}
- Primary Color: ${brandDna.colors.primary}
- Secondary Color: ${brandDna.colors.secondary}
- Accent Color: ${brandDna.colors.accent}
- Key Benefits: ${brandDna.keyBenefits?.join(", ") ?? ""}
- Forbidden Words: ${brandDna.forbiddenWords?.join(", ") ?? ""}
- Required Wording: ${brandDna.requiredWording?.join(", ") ?? "none"}${brandDna.avoidedHooks?.length ? `\n- Avoided hook types (FORBIDDEN): ${brandDna.avoidedHooks.join(", ")}` : ""}${brandDna.preferredHooks?.length ? `\n- Preferred hook types: ${brandDna.preferredHooks.join(", ")}` : ""}${brandDna.legalConstraints?.length ? `\n- Legal constraints (copy must NOT violate): ${brandDna.legalConstraints.join("; ")}` : ""}${brandDna.pricePositioning ? `\n- Price positioning: ${brandDna.pricePositioning}` : ""}

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

1. BRAND CONSISTENCY (0–1)
   - Copy matches the brand tone of voice exactly
   - No forbidden words used
   - Required wording is present (if any)
   - The creative feels unmistakably like this brand, not a generic competitor

2. COPY QUALITY (0–1)
   - Headline is punchy, clear, and uses the hook angle correctly
   - Subheadline supports the headline without repeating it
   - Body copy is compelling and within brand voice
   - CTA is clear, action-oriented, and creates urgency

3. STRATEGIC ALIGNMENT (0–1)
   - The creative addresses a real pain point or aspiration of the target personas
   - The hook angle is executed well (not just named, but felt)
   - The brand's key benefits are surfaced naturally${hasImage ? `

4. VISUAL EXECUTION (0–1)
   - Image layout matches the brief description
   - Brand primary color (${brandDna.colors.primary}) is prominently used
   - Product or brand imagery is clearly recognizable and well-presented
   - Visual hierarchy: eye flows naturally from headline → product → CTA
   - Professional composition — no cluttered, unbalanced, or awkward layouts

5. TEXT LEGIBILITY IN IMAGE (0–1)
   - All text overlays are readable at standard Instagram/Facebook feed size
   - Font weight and contrast ensure legibility on the background
   - No spelling errors or garbled AI-generated text
   - CTA is distinct and easy to identify at a glance

6. ON-BRAND IDENTITY (0–1)
   - This looks like it was produced by ${brandDna.name}'s in-house design team
   - It does NOT look generic, AI-generated, or like a stock template
   - The visual style reflects the brand's category and positioning
   - Premium feel appropriate for the brand's price point

7. META ADS COMPLIANCE (0–1)
   - No prohibited content (no misleading claims, no prohibited product categories)
   - Text-to-image ratio: text overlay covers less than 20% of the image area
   - Safe zones respected: key visual elements are not in the outer 8% of the frame
   - No watermarks, logos of third parties, or competitor branding
   - No low-quality, blurry, or pixelated elements
   - CTA button text is platform-appropriate (e.g., "Shop Now", not just "Buy")
   - Image would not be flagged by Meta's automated review system` : ""}${additionalComplianceSection}

SCORING GUIDE:
- 0.9–1.0: Premium agency quality. Upload-ready for a top DTC brand's Meta campaign.
- 0.7–0.89: Good quality. Minor issues but meets the bar for approval. Upload-ready.
- 0.5–0.69: Average. Would not pass for a demanding brand. Regeneration needed.
- 0.3–0.49: Generic or significantly off-brand. Fails the "internal team" test.
- 0.0–0.29: Clearly wrong — wrong colors, wrong tone, visible errors, or would be rejected by Meta.
${hasInspiration ? `
INSPIRATION FIDELITY (dual scoring mode — STA-95):
You have been shown the inspiration image first, then the generated creative.
In addition to the overall score, score fidelityScore (0–1) for how faithfully the generated creative clones the structural layout of the inspiration:
- 0.9–1.0: Near-identical structure — same layout zones, visual hierarchy, and composition
- 0.7–0.89: Clear structural similarity — key zones recognisable, some adaptation is fine
- 0.5–0.69: Loosely inspired — major structural differences
- 0.0–0.49: No recognisable structural relationship
Also score brandScore (0–1) purely for brand DNA alignment (tone, colors, persona, forbidden words).
Final composite = 0.6 × fidelityScore + 0.4 × brandScore (computed externally — do not set score to the composite).
` : ""}
Call the submit_qa_review tool with your full assessment.`;

  // Build the message content: include the image when available (Claude vision)
  // Phase C: prepend inspiration image first when dual scoring is active
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } };

  const content: ContentBlock[] = [];

  if (hasInspiration) {
    content.push({ type: "text", text: "INSPIRATION IMAGE (structural template to clone):" });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: inspirationBase64! },
    });
  }

  if (hasImage) {
    if (hasInspiration) {
      content.push({ type: "text", text: "GENERATED CREATIVE (what you are reviewing):" });
    }
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: imageBase64! },
    });
  }
  content.push({ type: "text", text: textSection });

  // Use tool_use for guaranteed valid JSON — no parsing errors possible.
  const response = await client.messages.create({
    model: CLAUDE_QA_MODEL,
    max_tokens: 1200,
    tools: [
      {
        name: "submit_qa_review",
        description: "Submit the comprehensive QA review for this Meta Ad creative",
        input_schema: {
          type: "object" as const,
          properties: {
            score: {
              type: "number",
              description: "Overall quality score 0.0–1.0. Use the scoring guide strictly. 0.7+ = approved for Meta upload.",
            },
            approved: {
              type: "boolean",
              description: "true if score >= 0.7 and metaReady is true",
            },
            feedback: {
              type: "string",
              description: "One concise sentence summarising overall quality and the most critical issue (if any)",
            },
            brandConsistency: {
              type: "string",
              description: "Assessment of brand DNA alignment — tone, colors, forbidden words, on-brand feel",
            },
            textQuality: {
              type: "string",
              description: "Assessment of all copy: headline impact, copy clarity, CTA strength",
            },
            visualQuality: {
              type: "string",
              description: hasImage
                ? "Assessment of the actual image: layout accuracy, color usage, product prominence, composition quality, text legibility in-image"
                : "Assessment of the visual concept described in the brief",
            },
            metaReady: {
              type: "boolean",
              description: "true if this creative could be uploaded to Meta Business Manager today without any edits — passes compliance, has no visible quality issues, and looks professional",
            },
            visualImprovements: {
              type: "array",
              items: { type: "string" },
              description: "Specific visual/layout/composition fixes for Gemini. Each item is a concrete instruction (e.g., 'Increase product size to fill 60% of the frame', 'Use #C8A96E as the dominant background color')",
            },
            copyImprovements: {
              type: "array",
              items: { type: "string" },
              description: "Specific copy or text-overlay fixes (e.g., 'Replace headline with shorter, punchier version under 5 words', 'Make CTA button more prominent with higher contrast')",
            },
            brandImprovements: {
              type: "array",
              items: { type: "string" },
              description: "Brand alignment fixes — what needs to change to make this look like the brand's own work",
            },
            metaComplianceIssues: {
              type: "array",
              items: { type: "string" },
              description: "Any Meta Ads policy or technical issues that would prevent upload or trigger rejection",
            },
            improvements: {
              type: "array",
              items: { type: "string" },
              description: "Combined list of the top 3 most impactful improvements (prioritised by score impact)",
            },
            ...(hasInspiration && {
              fidelityScore: {
                type: "number",
                description: "Structural fidelity to inspiration image (0–1). How faithfully the generated creative clones the layout, visual hierarchy, and composition of the inspiration.",
              },
              brandScore: {
                type: "number",
                description: "Brand DNA alignment score (0–1). Tone, colors, personas, forbidden words, required wording — independent of fidelity.",
              },
            }),
          },
          required: [
            "score", "approved", "feedback",
            "brandConsistency", "textQuality", "visualQuality",
            "metaReady",
            "visualImprovements", "copyImprovements", "brandImprovements",
            "metaComplianceIssues", "improvements",
          ],
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
