// Gemini image generation pipeline (STA-13)
// Takes a creative brief from Claude and generates the ad image via Gemini
// Gemini is THE ONLY image model — no fallback (SPECS.md §1.5)

import { createGeminiClient, getGeminiImageModel } from "@/lib/gemini";
import { createClaudeClient, CLAUDE_MODEL } from "@/lib/claude";
import { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import { uploadToR2, creativeKey } from "@/lib/r2";
import type { AdFormat, CreativeAngle, ImageQuality } from "@/types/index";
import type { Template } from "@prisma/client";

/**
 * State-machine JSON repair: escapes any literal control characters
 * (newline, carriage-return, tab) that appear INSIDE JSON string values.
 * Claude occasionally emits these bare, which is technically invalid JSON
 * and causes JSON.parse to throw "Unterminated string".
 */
function repairJsonStrings(raw: string): string {
  let inString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      result += ch;
      escaped = false;
    } else if (ch === "\\" && inString) {
      result += ch;
      escaped = true;
    } else if (ch === '"') {
      result += ch;
      inString = !inString;
    } else if (inString && ch === "\n") {
      result += "\\n";
    } else if (inString && ch === "\r") {
      result += "\\r";
    } else if (inString && ch === "\t") {
      result += "\\t";
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Detect the true MIME type from the first bytes of an image buffer.
 * More reliable than HTTP Content-Type headers, which are sometimes wrong
 * (e.g. a server serving PNGs with image/jpeg).
 */
function detectMimeType(buf: Buffer): string {
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 12 &&
      buf.subarray(0, 4).toString("binary") === "RIFF" &&
      buf.subarray(8, 12).toString("binary") === "WEBP") {
    return "image/webp";
  }
  if (buf.length >= 6 &&
      (buf.subarray(0, 6).toString() === "GIF87a" || buf.subarray(0, 6).toString() === "GIF89a")) {
    return "image/gif";
  }
  return "image/jpeg"; // fallback
}

/**
 * Fetch a remote image URL and return it as a base64 string with its MIME type.
 * Used to send BDD template images to Claude (vision) and Gemini.
 * Silently returns null on network errors so a failed image fetch never
 * blocks the generation pipeline.
 */
async function fetchImageBase64(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Detect MIME from magic bytes — headers are not always reliable
    const mimeType = detectMimeType(buf);
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

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
  inspirationTemplateIds?: string[]; // BDD template IDs used as inspiration (STA-58)
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
  options?: {
    anthropicApiKey?: string;
    geminiApiKey?: string;
    inspirationTemplates?: Template[];
    imageQuality?: ImageQuality;
    creativeBrief?: string; // Optional user guidance injected into Claude's briefing prompt
    referenceImageUrl?: string; // "From example" mode: single reference image URL (skips BDD templates)
    referenceImageData?: { data: string; mimeType: string }; // "From example" mode: pre-loaded base64 (drag-and-drop upload)
  }
): Promise<GeneratedCreative> {
  const { anthropicApiKey, geminiApiKey, inspirationTemplates, imageQuality, creativeBrief, referenceImageUrl, referenceImageData } = options ?? {};

  // "From example" mode: use pre-loaded base64 (drag-and-drop) or fetch from URL, skip BDD template matching
  let preloadedImages: FetchedImage[] | undefined;
  if (referenceImageData) {
    // Drag-and-drop: image already in memory, use directly
    preloadedImages = [referenceImageData];
  } else if (referenceImageUrl) {
    const img = await fetchImageBase64(referenceImageUrl);
    if (img) preloadedImages = [img];
  }

  // Step 1: Generate the creative brief via Claude (also fetches BDD template images for vision)
  const { brief, templateImages, productImages } = await generateCreativeBrief(
    brandDna,
    format,
    angle,
    anthropicApiKey,
    // In "from example" mode, skip BDD templates — use the single reference image instead
    preloadedImages ? undefined : inspirationTemplates,
    creativeBrief,
    preloadedImages
  );

  // Step 2: Generate the image via Gemini (pass template images for style + product images as real assets)
  const imageData = await generateImageWithGemini(
    brief,
    geminiApiKey ?? undefined,
    imageQuality,
    templateImages,
    productImages.length > 0 ? productImages : undefined
  );

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
  geminiApiKey?: string,
  imageQuality?: ImageQuality
): Promise<GeneratedCreative> {
  const enhancedPrompt = `${previous.brief.imagePrompt}\n\nQA FEEDBACK TO ADDRESS: ${feedback}`;
  const enhancedBrief = { ...previous.brief, imagePrompt: enhancedPrompt };

  const imageData = await generateImageWithGemini(enhancedBrief, geminiApiKey, imageQuality);

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
type FetchedImage = { data: string; mimeType: string };

async function generateCreativeBrief(
  brandDna: ExtractedBrandDNA,
  format: AdFormat,
  angle: CreativeAngle,
  apiKey?: string,
  inspirationTemplates?: Template[],
  creativeBrief?: string,
  preloadedImages?: FetchedImage[] // "From example" mode: bypass BDD fetch with a pre-fetched image
): Promise<{ brief: CreativeBrief; templateImages: FetchedImage[]; productImages: FetchedImage[] }> {
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

  // STA-84: Customer intelligence — inject real pain points, outcomes, messaging priority, CTAs
  const customerPainPointsSection = brandDna.customerPainPoints?.length
    ? `\n- Customer pain points: ${brandDna.customerPainPoints.slice(0, 5).join(" | ")}`
    : "";
  const customerDesiredOutcomeSection = brandDna.customerDesiredOutcome
    ? `\n- Customer desired outcome: ${brandDna.customerDesiredOutcome}`
    : "";
  const messagingHierarchySection = brandDna.messagingHierarchy?.length
    ? `\n- Messaging priority: ${brandDna.messagingHierarchy.map((m, i) => `${i + 1}) ${m}`).join(" → ")}`
    : "";
  const ctaExamplesSection = brandDna.callToActionExamples?.length
    ? `\n- CTA examples (use these, not generic "Shop Now"): ${brandDna.callToActionExamples.slice(0, 4).join(", ")}`
    : "";

  // STA-85: Hook preferences — guide Claude's angle selection and exclude forbidden hooks
  const preferredHooksSection = brandDna.preferredHooks?.length
    ? `\n- PREFERRED hooks (choose from these): ${brandDna.preferredHooks.join(", ")}`
    : "";
  const avoidedHooksSection = brandDna.avoidedHooks?.length
    ? `\n- FORBIDDEN hooks (absolutely never use): ${brandDna.avoidedHooks.join(", ")}`
    : "";

  // STA-86: Products — tell Claude which products to feature in the ad
  const productsPromptSection = brandDna.products?.length
    ? `\n- Featured products: ${brandDna.products.map((p) => `${p.name}${p.description ? ` — ${p.description.slice(0, 100)}` : ""}`).join("; ")}`
    : "";

  // STA-83: Visual style directives — explicitly injected into the imagePrompt field
  const visualDirectivesSection = (() => {
    const parts: string[] = [];
    if (brandDna.visualStyleKeywords?.length) {
      parts.push(`Style: ${brandDna.visualStyleKeywords.join(", ")}`);
    }
    if (brandDna.creativeDoList?.length) {
      parts.push(`Always include: ${brandDna.creativeDoList.slice(0, 5).join(" | ")}`);
    }
    if (brandDna.creativeDontList?.length) {
      parts.push(`Never show: ${brandDna.creativeDontList.slice(0, 5).join(" | ")}`);
    }
    return parts.length > 0
      ? `\n\nVISUAL STYLE DIRECTIVES (copy ALL of these verbatim into the imagePrompt field):\n${parts.map((p) => `- ${p}`).join("\n")}`
      : "";
  })();

  // Valid MIME types for Claude vision API
  type ClaudeImageMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  function toClaudeMime(mime: string): ClaudeImageMime {
    if (mime === "image/png") return "image/png";
    if (mime === "image/gif") return "image/gif";
    if (mime === "image/webp") return "image/webp";
    return "image/jpeg"; // default fallback
  }

  // Fetch template images for Claude vision (top 3, using thumbnail when available)
  // "From example" mode: use preloadedImages directly and skip BDD template fetching
  const templateImages: { data: string; mimeType: string; label: string }[] = [];
  if (preloadedImages && preloadedImages.length > 0) {
    for (const img of preloadedImages) {
      templateImages.push({ ...img, label: "Reference ad" });
    }
  } else if (inspirationTemplates && inspirationTemplates.length > 0) {
    const toFetch = inspirationTemplates.slice(0, 3);
    const fetched = await Promise.all(
      toFetch.map(async (t, i) => {
        const url = t.thumbnailUrl ?? t.sourceImageUrl;
        const img = await fetchImageBase64(url);
        return img ? { ...img, label: `Ad ${i + 1}` } : null;
      })
    );
    for (const img of fetched) {
      if (img) templateImages.push(img);
    }
  }

  // STA-86: Fetch product images for Gemini (up to 3 images across all products)
  const productImages: FetchedImage[] = [];
  if (brandDna.products?.length) {
    const productImageUrls = brandDna.products
      .flatMap((p) => p.images.slice(0, 2))
      .slice(0, 3);
    const fetched = await Promise.all(productImageUrls.map((url) => fetchImageBase64(url)));
    for (const img of fetched) {
      if (img) productImages.push(img);
    }
  }

  // Build inspiration context section for Claude
  let inspirationSection = "";
  if (preloadedImages && preloadedImages.length > 0) {
    // "From example" mode: single user-provided reference image
    inspirationSection = `\nREFERENCE AD — The client has provided a specific ad image above as a reference. Study it carefully: understand the visual composition, copywriting style, hook execution, layout, and product placement. Your job is to create a brief that replicates the same structural approach and creative quality, but adapted entirely to ${brandDna.name}'s brand DNA, colors, tone, and product.\n\nDo NOT copy the reference ad. Adapt its winning structure to ${brandDna.name}'s brand.\n`;
  } else if (inspirationTemplates && inspirationTemplates.length > 0) {
    // "From database" mode: BDD curated templates
    inspirationSection = `\nBDD INSPIRATION — You have been shown ${templateImages.length > 0 ? `${templateImages.length} actual winning ad images above` : "the following winning ad metadata"}. These are high-performing creatives for this angle and category. Study them carefully: understand the visual composition, copywriting style, layout structure, and why they win. Then create a brief that adapts these winning principles to ${brandDna.name}'s brand DNA.
${inspirationTemplates
  .map((t, i) => {
    const analysis = t.analysisJson as Record<string, unknown>;
    return `Ad ${i + 1}: type=${t.type}, layout=${t.layout}, hookType=${t.hookType}, palette=[${t.palette.join(", ")}]${
      analysis.headline ? `, headline="${analysis.headline}"` : ""
    }${analysis.copyStyle ? `, copyStyle="${analysis.copyStyle}"` : ""}`;
  })
  .join("\n")}

Do NOT copy these ads. Adapt their winning structure and visual DNA to ${brandDna.name}'s brand.\n`;
  }

  const userBriefSection = creativeBrief
    ? `\n\nUSER BRIEF (mandatory — these instructions OVERRIDE defaults and must be reflected in every field below):\n${creativeBrief}\n`
    : "";

  const textPrompt = `You are a senior creative director at a top DTC advertising agency. Create a detailed creative brief for a static Meta Ad that is unmistakably "on brand" for this brand.${inspirationSection}${userBriefSection}

IMPORTANT: Use brand colors contextually. Do not override the inspiration image layout background with the primary color.

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
- Forbidden Words: ${brandDna.forbiddenWords?.join(", ") ?? ""}${requiredWording}${brandBriefSection}${anglesSection}${customAssetsSection}${vocabSection}${customerPainPointsSection}${customerDesiredOutcomeSection}${messagingHierarchySection}${ctaExamplesSection}${preferredHooksSection}${avoidedHooksSection}${productsPromptSection}${visualDirectivesSection}

AD PARAMETERS:
- Format: ${format} (${isPortrait ? "vertical portrait" : isLandscape ? "horizontal landscape" : "square"})
- Hook angle: ${angle}
- Language: ${brandDna.language}

Call the submit_creative_brief tool with the completed brief. For imagePrompt: write it as one continuous paragraph with no line breaks — it must read as a single flowing instruction for the image model.`;

  // Build multimodal message: template images first (vision), then text prompt
  const messageContent = [
    ...templateImages.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: toClaudeMime(img.mimeType),
        data: img.data,
      },
    })),
    { type: "text" as const, text: textPrompt },
  ];

  // Use tool_use to get guaranteed valid JSON — eliminates all JSON parse errors.
  // When tool_choice is forced, Claude serialises the output as structured data
  // rather than text, so no regex stripping or repair is ever needed.
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [
      {
        name: "submit_creative_brief",
        description: "Submit the completed creative brief for this Meta Ad",
        input_schema: {
          type: "object" as const,
          properties: {
            headline:      { type: "string", description: "Main headline — max 6 words, punchy, uses the hook angle" },
            subheadline:   { type: "string", description: "Supporting line — max 12 words" },
            copy:          { type: "string", description: `Body copy — max 20 words, ${brandDna.toneOfVoice} tone` },
            callToAction:  { type: "string", description: "CTA button text — 2-4 words, ALWAYS ALL CAPS (e.g. SHOP NOW, GET 50% OFF, TRY FOR FREE)" },
            angle:         { type: "string", description: "Creative angle (must match requested angle)" },
            format:        { type: "string", description: "Ad format (must match requested format)" },
            layout:        { type: "string", description: "Visual layout: product placement, text zones, hierarchy" },
            colorGuidance: { type: "string", description: `brand colors — primary ${brandDna.colors.primary} as dominant brand color (use contextually based on inspiration layout: CTA fill, overlay strip, text — do NOT force it as background if inspiration shows a different approach), accent ${brandDna.colors.accent} for CTA` },
            fontGuidance:  { type: "string", description: `Font hierarchy — ${brandDna.fonts?.[0] ?? "sans-serif"} bold for headline, regular for body` },
            imagePrompt:   { type: "string", description: `Gemini image generation prompt — single continuous paragraph, no line breaks. MUST incorporate all Visual Style Directives above verbatim. Include: layout, product placement, use ${brandDna.colors.primary} as primary brand color placed contextually (CTA button, overlay, text), text positions, visual style${brandDna.visualStyleKeywords?.length ? ` (${brandDna.visualStyleKeywords.slice(0, 3).join(", ")})` : ""}${brandDna.creativeDoList?.length ? `, DO: ${brandDna.creativeDoList.slice(0, 2).join("; ")}` : ""}${brandDna.creativeDontList?.length ? `, NEVER: ${brandDna.creativeDontList.slice(0, 2).join("; ")}` : ""}. Must look like ${brandDna.name}'s in-house design team. Category: ${brandDna.productCategory}. Format: ${format}. Photorealistic, professional ad quality, no watermarks.` },
          },
          required: ["headline", "subheadline", "copy", "callToAction", "angle", "format", "layout", "colorGuidance", "fontGuidance", "imagePrompt"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_creative_brief" },
    messages: [{ role: "user", content: messageContent }],
  });

  // Extract from the tool_use block — guaranteed valid, no parsing needed.
  const toolUseBlock = response.content.find((c) => c.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Claude did not return a creative brief via tool_use");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = toolUseBlock.input as Omit<CreativeBrief, "brandDnaRef" | "inspirationTemplateIds">;

  const brief: CreativeBrief = {
    ...parsed,
    // Guarantee CTA is always uppercase regardless of what Claude returns
    callToAction: parsed.callToAction?.toUpperCase() ?? parsed.callToAction,
    brandDnaRef: brandDna,
    ...(inspirationTemplates?.length
      ? { inspirationTemplateIds: inspirationTemplates.map((t) => t.id) }
      : {}),
  };
  return { brief, templateImages, productImages };
}

/**
 * Gemini generates the ad image from the creative brief.
 * This is THE ONLY image generation model (SPECS.md §1.5 §4.1 step 5).
 *
 * responseModalities must be set at model instantiation (not per-request) in
 * @google/generative-ai >=0.21. Passing it only in generateContent is silently
 * ignored in some SDK versions, causing Gemini to return text only.
 */
async function generateImageWithGemini(
  brief: CreativeBrief,
  apiKey?: string,
  quality?: ImageQuality,
  referenceImages?: { data: string; mimeType: string }[],
  productImages?: { data: string; mimeType: string }[]
): Promise<string> {
  const client = createGeminiClient(apiKey);
  const modelName = getGeminiImageModel(quality);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = client.getGenerativeModel({
    model: modelName,
    // responseModalities is not yet in the SDK's GenerationConfig types but is
    // required for the image generation model — cast to any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] } as any,
  });

  // Build multimodal prompt: product images first (real assets), then style references, then text
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];

  // Product images come first — they are real brand assets to incorporate in the ad (STA-86)
  if (productImages && productImages.length > 0) {
    for (const img of productImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }
  // Style reference images (BDD templates or user-provided "from example")
  if (referenceImages && referenceImages.length > 0) {
    for (const img of referenceImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }

  // Build text prompt — clearly distinguish product assets from style references
  let promptText: string;
  if (productImages?.length && referenceImages?.length) {
    promptText = `The first ${productImages.length} image(s) are REAL product photos from the brand — compose the ad using these actual product assets as the hero imagery, do NOT generate fake product imagery. The next ${referenceImages.length} image(s) are style reference ads — use them for layout, composition, and visual style inspiration only. ${brief.imagePrompt}`;
  } else if (productImages?.length) {
    promptText = `The ${productImages.length} image(s) shown are REAL product photos from the brand. Compose the ad using these actual product assets as the hero imagery — do NOT generate new product imagery, use these real photos. ${brief.imagePrompt}`;
  } else if (referenceImages?.length) {
    promptText = `You are shown ${referenceImages.length} reference ad image(s) above as creative inspiration. Study their visual composition, layout, and style. Now generate a NEW static ad image that captures the same structural quality and visual impact, but adapted for this brand. ${brief.imagePrompt}`;
  } else {
    promptText = brief.imagePrompt;
  }
  parts.push({ text: promptText });

  const response = await model.generateContent({
    contents: [{ role: "user", parts }],
  });

  const candidate = response.response.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  // Extract base64 image data from the inline image part
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseParts = (candidate.content?.parts ?? []) as any[];
  const imagePart = responseParts.find((p: any) => p.inlineData?.data);
  if (!imagePart) {
    // Surface Gemini's finish reason to make debugging easier
    const finishReason = candidate.finishReason ?? "unknown";
    const textPart = responseParts.find((p: any) => typeof p.text === "string");
    const detail = textPart ? ` Gemini said: "${textPart.text}"` : "";
    throw new Error(
      `Gemini response did not contain an image (finishReason=${finishReason}).${detail}`
    );
  }

  return imagePart.inlineData.data as string;
}
