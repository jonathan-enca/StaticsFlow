// Gemini image generation pipeline (STA-13)
// Takes a creative brief from Claude and generates the ad image via Gemini
// Gemini is THE ONLY image model — no fallback (SPECS.md §1.5)

import sharp from "sharp";
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
 * STA-107: Composite the brand logo onto a generated image buffer using Sharp.js.
 * - Fetches logoUrl, resizes to ~15% of the image width
 * - Overlays at bottom-right with 20px safe-zone padding
 * - Returns the composited buffer. On any failure (null logoUrl, fetch error,
 *   Sharp error) returns the original buffer so generation never hard-fails.
 */
async function compositeAssets(
  imageBuffer: Buffer,
  brandDna: ExtractedBrandDNA
): Promise<Buffer> {
  const logoUrl = brandDna.logoUrl;
  if (!logoUrl) return imageBuffer;

  let logoBuffer: Buffer;
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return imageBuffer;
    logoBuffer = Buffer.from(await res.arrayBuffer());
  } catch {
    console.warn("[compositeAssets] Failed to fetch logo — skipping overlay");
    return imageBuffer;
  }

  try {
    // Get base image dimensions
    const baseMeta = await sharp(imageBuffer).metadata();
    const baseWidth = baseMeta.width ?? 1080;
    const baseHeight = baseMeta.height ?? 1080;

    // Resize logo to ~15% of image width, preserving aspect ratio
    const logoTargetWidth = Math.round(baseWidth * 0.15);
    const resizedLogo = await sharp(logoBuffer)
      .resize({ width: logoTargetWidth, withoutEnlargement: true })
      .toBuffer();

    const logoMeta = await sharp(resizedLogo).metadata();
    const logoW = logoMeta.width ?? logoTargetWidth;
    const logoH = logoMeta.height ?? logoTargetWidth;

    // Bottom-right safe-zone: 20px padding from edges
    const padding = 20;
    const left = baseWidth - logoW - padding;
    const top = baseHeight - logoH - padding;

    const composited = await sharp(imageBuffer)
      .composite([{ input: resizedLogo, left, top, blend: "over" }])
      .png()
      .toBuffer();

    return composited;
  } catch (err) {
    console.warn("[compositeAssets] Sharp compositing failed — returning original:", err);
    return imageBuffer;
  }
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

  // Step 3: STA-107 — composite brand logo onto the generated image before storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalBuffer: Buffer = Buffer.from(imageData, "base64") as any;
  finalBuffer = await compositeAssets(finalBuffer, brandDna) as any;

  // Step 4: Upload to R2 (skip if R2 not configured in dev)
  let imageUrl: string;
  let imageBase64: string | undefined;

  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCOUNT_ID !== "YOUR_CLOUDFLARE_ACCOUNT_ID") {
    const key = creativeKey(userId, brandId, creativeId);
    imageUrl = await uploadToR2(key, finalBuffer, "image/png");
  } else {
    // Dev fallback: store full data URL so the image is displayable without R2
    const finalBase64 = finalBuffer.toString("base64");
    imageBase64 = finalBase64;
    imageUrl = `data:image/png;base64,${finalBase64}`;
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

  // STA-107: composite logo onto regenerated image as well
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalBuffer: Buffer = Buffer.from(imageData, "base64") as any;
  finalBuffer = await compositeAssets(finalBuffer, previous.brief.brandDnaRef) as any;

  let imageUrl: string;
  let imageBase64: string | undefined;

  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCOUNT_ID !== "YOUR_CLOUDFLARE_ACCOUNT_ID" &&
    userId && brandId && creativeId
  ) {
    const key = creativeKey(userId, brandId, `${creativeId}_v2`);
    imageUrl = await uploadToR2(key, finalBuffer, "image/png");
  } else {
    const finalBase64 = finalBuffer.toString("base64");
    imageBase64 = finalBase64;
    imageUrl = `data:image/png;base64,${finalBase64}`;
  }

  return { brief: enhancedBrief, imageUrl, imageBase64 };
}

/**
 * STA-108 / STA-127 #7: Map a hex color to a human-readable semantic name.
 * Expanded from ~12 to ~48 names with lightness qualifiers (e.g. "light navy",
 * "deep coral") so Gemini prompt color descriptions are precise and actionable.
 *
 * Methodology:
 *  1. Achromatic shortcuts (white/black/grey bands)
 *  2. Hue wheel split into 24 segments (~15° each)
 *  3. Each hue has 3 lightness variants: light / mid / deep
 */
function colorSemanticName(hex: string): string {
  const h = hex.replace("#", "").toLowerCase();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r)) return "brand color";

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255; // HSL lightness 0–1
  const chroma = max - min;

  // ── Achromatic ─────────────────────────────────────────────────────────────
  if (lightness > 0.93) return "off-white";
  if (lightness > 0.85) return "pale grey";
  if (lightness < 0.08) return "near-black";
  if (chroma < 18) {
    if (lightness > 0.70) return "light grey";
    if (lightness > 0.45) return "medium grey";
    if (lightness > 0.22) return "dark grey";
    return "charcoal";
  }

  // ── Hue calculation ────────────────────────────────────────────────────────
  const hue = (() => {
    if (max === r) return ((g - b) / chroma + (g < b ? 6 : 0)) / 6;
    if (max === g) return ((b - r) / chroma + 2) / 6;
    return ((r - g) / chroma + 4) / 6;
  })();

  // Lightness qualifier helper
  const lq = (light: string, mid: string, deep: string): string => {
    if (lightness > 0.65) return light;
    if (lightness > 0.35) return mid;
    return deep;
  };

  // ── 24 hue segments (~15° each) with 3-way lightness split ────────────────
  if (hue < 1 / 24)  return lq("light rose",       "crimson red",   "deep crimson");
  if (hue < 2 / 24)  return lq("light coral",       "warm red",      "dark red");
  if (hue < 3 / 24)  return lq("salmon",            "tomato red",    "brick red");
  if (hue < 4 / 24)  return lq("light coral-orange","orange-red",    "deep rust");
  if (hue < 5 / 24)  return lq("peach",             "burnt orange",  "dark rust");
  if (hue < 6 / 24)  return lq("light orange",      "warm orange",   "deep amber");
  if (hue < 7 / 24)  return lq("pale amber",        "golden amber",  "dark amber");
  if (hue < 8 / 24)  return lq("pale gold",         "golden yellow", "deep gold");
  if (hue < 9 / 24)  return lq("pale yellow",       "warm yellow",   "dark yellow");
  if (hue < 10 / 24) return lq("lime yellow",       "yellow-green",  "olive");
  if (hue < 11 / 24) return lq("light lime",        "lime green",    "dark olive");
  if (hue < 12 / 24) return lq("pale green",        "fresh green",   "deep green");
  if (hue < 13 / 24) return lq("mint",              "medium green",  "forest green");
  if (hue < 14 / 24) return lq("light seafoam",     "seafoam green", "deep emerald");
  if (hue < 15 / 24) return lq("pale teal",         "teal-green",    "dark teal-green");
  if (hue < 16 / 24) return lq("light teal",        "teal",          "deep teal");
  if (hue < 17 / 24) return lq("pale cyan",         "cyan",          "deep cyan");
  if (hue < 18 / 24) return lq("light sky blue",    "sky blue",      "deep sky blue");
  if (hue < 19 / 24) return lq("pale blue",         "medium blue",   "cobalt blue");
  if (hue < 20 / 24) return lq("light navy",        "navy blue",     "deep navy");
  if (hue < 21 / 24) return lq("light periwinkle",  "blue-violet",   "deep blue-violet");
  if (hue < 21.5 / 24) return lq("light lavender",  "violet",        "deep violet");
  if (hue < 22 / 24) return lq("lavender",          "purple",        "deep purple");
  if (hue < 22.5 / 24) return lq("light orchid",    "orchid",        "deep plum");
  if (hue < 23 / 24) return lq("light mauve",       "mauve",         "deep mauve");
  if (hue < 23.5 / 24) return lq("light pink",      "deep coral",    "burgundy");
  return lq("blush pink", "rose red", "deep crimson"); // wraps back to red
}

/**
 * STA-108: Return category-specific visual constraints to inject into Claude's
 * imagePrompt guidance so Gemini produces more targeted, less generic imagery.
 */
function getCategoryConstraints(productCategory: string): string {
  const cat = (productCategory ?? "").toLowerCase();
  if (/skincare|beauty|cosmetic|serum|moisturi|perfume|fragrance/.test(cat)) {
    return "clean white or soft neutral background, product hero centered at 55–65% height, no busy environment, clinical or soft-luxe aesthetic";
  }
  if (/fashion|clothing|apparel|wear|dress|shirt|shoe|bag|accessory/.test(cat)) {
    return "model or flat lay, product fills 40% of frame, studio lighting, aspirational styling, no props that distract from the garment";
  }
  if (/food|beverage|drink|coffee|tea|snack|supplement|nutrition/.test(cat)) {
    return "appetizing close-up lighting, product in natural context, warm inviting tones unless brand is minimal, no artificial-looking colours";
  }
  if (/tech|software|app|saas|digital|device|electronic/.test(cat)) {
    return "clean minimal background, device or screen as hero, subtle depth-of-field, modern flat-lay or perspective shot";
  }
  // Default for all other categories
  return "product as primary hero subject, no unrelated objects in frame, clean modern background";
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

  // STA-108: Category-specific visual language — injected into imagePrompt guidance
  const categoryConstraints = getCategoryConstraints(brandDna.productCategory ?? "");
  const categorySection = `\n\nCATEGORY VISUAL CONSTRAINTS (inject verbatim into imagePrompt):\n- ${categoryConstraints}`;

  // STA-108: Color mandate — hex codes MUST appear in caps with semantic description
  // STA-115 Phase 1.3: Prepend color roles to stop primary color bleeding into background
  const colorMandateSection = `\n\nCOLOR ROLES & SPECIFICITY MANDATE: Color roles are: background = white/neutral, body text = near-black, CTA/accent = primary color, decorative = secondary/accent. Do NOT use primary color as background.\n\nIn the imagePrompt field, always specify brand colors with BOTH the uppercase hex code AND a semantic name. Example: "CTA button fill: exact color ${brandDna.colors.primary.toUpperCase()} (${colorSemanticName(brandDna.colors.primary)}), NOT approximated". Do this for every color reference.`;

  // STA-115 Phase 2.2: Background mandate — uses adBackgroundColor when set by Dev2's schema update
  const adBg = brandDna.adBackgroundColor ?? "#FFFFFF";
  const backgroundSection = `\n\nBACKGROUND (mandatory): ${adBg} — photorealistic clean surface, no texture unless explicitly part of brand identity. The primary brand color MUST NEVER fill the background.`;

  // STA-108: Product framing — explicit placement instruction when real product images exist
  const productFramingSection =
    (brandDna.products?.length ?? 0) > 0
      ? `\n\nPRODUCT FRAMING (mandatory when product images are provided): Include in imagePrompt: "Primary product should occupy the center-lower third of the frame. Product must be fully recognizable, not abstracted, cropped, or replaced by a generic substitute."`
      : "";

  // STA-108: Negative prompt — always appended at end of imagePrompt
  const negativePromptInstruction = `\n\nNEGATIVE PROMPT (required at end of imagePrompt): Always end the imagePrompt with: "AVOID: generic stock imagery, watermarks, unrelated products, cluttered backgrounds, low-quality textures, cartoon style unless brand uses it."`;

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

IMPORTANT: Use brand colors contextually. Do not override the inspiration image layout background with the primary color. Study the background color of any inspiration ads shown and carry that exact background color into the imagePrompt for Gemini — do not substitute it with the primary brand color.

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
- Forbidden Words: ${brandDna.forbiddenWords?.join(", ") ?? ""}${requiredWording}${brandBriefSection}${anglesSection}${customAssetsSection}${vocabSection}${customerPainPointsSection}${customerDesiredOutcomeSection}${messagingHierarchySection}${ctaExamplesSection}${preferredHooksSection}${avoidedHooksSection}${productsPromptSection}${visualDirectivesSection}${categorySection}${colorMandateSection}${backgroundSection}${productFramingSection}${negativePromptInstruction}

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
            colorGuidance: { type: "string", description: `brand colors — primary ${brandDna.colors.primary} for CTA button, text accents, and small graphic elements ONLY — NEVER as background fill, accent ${brandDna.colors.accent} for CTA` },
            fontGuidance:  { type: "string", description: `Font hierarchy — ${brandDna.fonts?.[0] ?? "sans-serif"} bold for headline, regular for body` },
            imagePrompt:   { type: "string", description: `Gemini image generation prompt — single continuous paragraph, no line breaks. CRITICAL FIRST RULE — THE AD BACKGROUND MUST BE WHITE (#FFFFFF) OR A VERY LIGHT NEUTRAL (>=95% LIGHTNESS). THE PRIMARY BRAND COLOR MUST NEVER FILL THE BACKGROUND — RESERVE IT FOR CTA BUTTONS, TEXT ACCENTS, AND SMALL GRAPHIC ELEMENTS ONLY. VIOLATION OF THIS RULE IS A LAYOUT FAILURE. Rules: (1) MUST incorporate all Visual Style Directives and Category Visual Constraints verbatim. (2) Specify every brand color with BOTH its uppercase hex code AND a semantic name, e.g. "CTA button fill: exact color ${brandDna.colors.primary.toUpperCase()} (${colorSemanticName(brandDna.colors.primary)}), NOT approximated". (3) ${(brandDna.products?.length ?? 0) > 0 ? "Include explicit product framing: primary product occupies center-lower third of frame, fully recognizable, not abstracted." : "Product as primary hero subject."} (4) Include layout, text positions, visual style${brandDna.visualStyleKeywords?.length ? ` (${brandDna.visualStyleKeywords.slice(0, 3).join(", ")})` : ""}${brandDna.creativeDoList?.length ? `, DO: ${brandDna.creativeDoList.slice(0, 2).join("; ")}` : ""}${brandDna.creativeDontList?.length ? `, NEVER: ${brandDna.creativeDontList.slice(0, 2).join("; ")}` : ""}. Must look like ${brandDna.name}'s in-house design team. Category: ${brandDna.productCategory}. Format: ${format}. Photorealistic professional ad quality.${brandDna.logoUrl ? ' (5) LOGO SAFE ZONE (mandatory): The bottom-right corner area (approximately 20% of image width × 15% of image height) MUST remain free of CTA buttons, text overlays, decorative frames, or any overlapping element. This zone is reserved for the brand logo that will be composited after generation. Violation of this zone is a layout failure.' : ''} (${brandDna.logoUrl ? "6" : "5"}) ALWAYS end with: "AVOID: generic stock imagery, watermarks, unrelated products, cluttered backgrounds, low-quality textures, cartoon style unless brand uses it."` },
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
 * Uses the @google/genai SDK (replaces legacy @google/generative-ai).
 * responseModalities is passed in the request config (not at model instantiation).
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

  const response = await client.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const candidate = response.candidates?.[0];
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
