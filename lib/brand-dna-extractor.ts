// Brand DNA extraction: Claude analysis of scraped website content
// Returns a structured BrandDNA JSON (see types/index.ts)

import { createClaudeClient, CLAUDE_MODEL } from "@/lib/claude";
import { scrapeWebsite, ScrapeResult } from "@/lib/scraper";
import type { CustomerVocabulary, Persona, CommunicationAngles, CustomAsset } from "@/types/index";

export interface ExtractedBrandDNA {
  // ── Auto-extracted (Phase 1) ───────────────────────────────────────────────
  name: string;
  url: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: string[];
  logoUrl: string | null;
  productImages: string[];
  lifestyleImages: string[];
  toneOfVoice: string;
  language: string;
  keyBenefits: string[];
  personas: string[];           // Legacy: simple string[] from Phase 1 extraction
  brandVoice: string;
  forbiddenWords: string[];
  productCategory: string;

  // ── Identity & Positioning (STA-55) ───────────────────────────────────────
  brandArchetype?: "Hero" | "Outlaw" | "Sage" | "Lover" | "Jester" | "Innocent" | "Creator" | "Caregiver" | "Ruler" | "Explorer" | "Magician" | "Regular";
  pricePositioning?: "budget" | "mid-range" | "premium" | "ultra-premium";
  targetMarkets?: string[];
  competitorBrands?: string[];
  differentiators?: string[];

  // ── Voice & Messaging (STA-55) ────────────────────────────────────────────
  brandVoiceAdjectives?: string[];   // max 6, e.g. bold, playful, trustworthy
  mandatoryMentions?: string[];      // always include (legal requirements)
  messagingHierarchy?: string[];     // ordered: primary, secondary, tertiary messages
  callToActionExamples?: string[];

  // ── Creative Direction (STA-55) ───────────────────────────────────────────
  visualStyleKeywords?: string[];    // e.g. minimalist, editorial, raw UGC, luxury
  moodboardUrls?: string[];
  creativeDoList?: string[];
  creativeDontList?: string[];
  preferredHooks?: Array<"pain" | "curiosite" | "social_proof" | "fomo" | "benefice_direct" | "autorite" | "urgence">;
  avoidedHooks?: string[];
  referenceAdUrls?: string[];

  // ── Customer Intelligence (STA-55) ────────────────────────────────────────
  customerReviewsVerbatim?: string[];  // max 10 real customer quotes
  customerPainPoints?: string[];
  customerDesiredOutcome?: string;
  customerObjections?: string[];

  // ── Campaign Context (STA-55) — collapsible/advanced ─────────────────────
  currentCampaignObjective?: "awareness" | "consideration" | "conversion" | "retention";
  currentPromotion?: string;
  seasonalConstraints?: string[];
  legalConstraints?: string[];

  // ── Enrichment layer (Phase 2 — STA-21) ───────────────────────────────────
  // Customer reviews (section 2.1)
  reviewsUrl?: string;
  customerVocabulary?: CustomerVocabulary;

  // Wording rules (section 2.2)
  requiredWording?: string[];   // Always say (regulatory, brand-mandatory)

  // Custom assets uploaded by user (section 2.2)
  customAssets?: CustomAsset[];

  // Brand charter (section 2.2)
  brandBrief?: string;          // "we want to be perceived as X, never as Y"
  structuredPersonas?: Persona[];
  communicationAngles?: CommunicationAngles;

  // ── Scraped assets (STA-63) ───────────────────────────────────────────────
  icons?: string[];             // favicon / icon URLs from the site
}

/**
 * Main entry point: scrape a URL and extract the Brand DNA via Claude.
 */
export async function extractBrandDNA(
  url: string,
  anthropicApiKey?: string
): Promise<ExtractedBrandDNA> {
  // Step 1: Scrape the website
  const scraped = await scrapeWebsite(url);

  // Step 2: Send to Claude for structured analysis
  const dna = await analyzeBrandWithClaude(scraped, anthropicApiKey);

  return dna;
}

/**
 * Extract customer vocabulary from a reviews page (section 2.1).
 * Claude scrapes the reviews URL and extracts verbatims + recurring vocabulary.
 */
export async function extractCustomerVocabulary(
  reviewsUrl: string,
  brandName: string,
  anthropicApiKey?: string
): Promise<CustomerVocabulary> {
  // Scrape the reviews page
  let reviewsContent = "";
  try {
    const scraped = await scrapeWebsite(reviewsUrl);
    reviewsContent = scraped.pages
      .map((p) => `${p.title}\n${p.bodyText}`)
      .join("\n\n");
  } catch (err) {
    throw new Error(
      `Failed to scrape reviews URL (${reviewsUrl}): ${(err as Error).message}`
    );
  }

  if (!reviewsContent.trim()) {
    throw new Error("No content found at the reviews URL.");
  }

  const client = createClaudeClient(anthropicApiKey);

  const prompt = `You are a consumer insights analyst. Analyze the following customer reviews for "${brandName}" and extract the authentic vocabulary customers use to describe this brand and its products.

REVIEWS CONTENT:
${reviewsContent.slice(0, 8000)}

Extract the customer vocabulary and return ONLY a valid JSON object with this exact structure:

{
  "verbatims": [
    "Exact quote from a real customer review (max 30 words each)",
    ... (15-25 most impactful and representative quotes)
  ],
  "recurringWords": [
    "word or short phrase that customers repeatedly use",
    ... (10-20 items — single words or 2-3 word phrases the customers ACTUALLY used, not generic words like 'good' or 'great')
  ],
  "emotionalWords": [
    "emotional word or phrase showing how customers FEEL",
    ... (8-15 items — specific emotions like 'finally feel confident', 'game-changer', 'obsessed', 'life-changing')
  ]
}

CRITICAL RULES:
1. Return ONLY the JSON object — no preamble, no markdown fences
2. verbatims must be EXACT quotes from the reviews, not paraphrases
3. recurringWords must be words/phrases CUSTOMERS used, not marketing language
4. emotionalWords must convey real emotion, not just adjectives
5. Prefer specific language over generic (e.g. "skin feels like silk" > "soft skin")`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  try {
    return JSON.parse(cleaned) as CustomerVocabulary;
  } catch {
    throw new Error(
      `Claude returned invalid JSON for customer vocabulary: ${text.slice(0, 300)}`
    );
  }
}

async function analyzeBrandWithClaude(
  scraped: ScrapeResult,
  apiKey?: string
): Promise<ExtractedBrandDNA> {
  const client = createClaudeClient(apiKey);

  // Aggregate Trustpilot data across all scraped pages (first hit wins)
  const trustpilot = scraped.pages.find((p) => p.trustpilot)?.trustpilot ?? null;

  // Aggregate icons across all scraped pages (deduplicated)
  const allIcons = [...new Set(scraped.pages.flatMap((p) => p.icons ?? []))].slice(0, 20);

  // Build a compact summary of scraped content to send to Claude
  const pagesContent = scraped.pages
    .map(
      (p, i) =>
        `=== Page ${i + 1}: ${p.url} ===\n` +
        `Title: ${p.title}\n` +
        `Description: ${p.description}\n` +
        `Body text (excerpt):\n${p.bodyText}\n` +
        `Images found: ${p.images.slice(0, 8).join(", ")}\n` +
        `Icons found: ${(p.icons ?? []).slice(0, 5).join(", ")}\n` +
        `Colors detected: ${p.colors.slice(0, 10).join(", ")}\n` +
        `Fonts detected: ${p.fonts.join(", ")}\n` +
        (p.trustpilot
          ? `Trustpilot: score=${p.trustpilot.score ?? "?"}, reviews=${p.trustpilot.reviewCount ?? "?"}\n` +
            (p.trustpilot.verbatims.length
              ? `Trustpilot reviews: ${p.trustpilot.verbatims.slice(0, 3).map((v) => `"${v}"`).join(" | ")}\n`
              : "")
          : "")
    )
    .join("\n\n");

  // Also pass the Trustpilot verbatims separately for direct use
  const trustpilotVerbatims = trustpilot?.verbatims ?? [];

  const prompt = `You are a senior creative strategist and brand analyst. Analyze the following website content and extract a complete Brand DNA profile. Be specific, concrete, and opinionated — generic answers are not acceptable.

WEBSITE URL: ${scraped.baseUrl}

SCRAPED CONTENT:
${pagesContent}

Return ONLY a valid JSON object with EXACTLY this structure (omit a field entirely rather than guessing — no hallucination):

{
  "name": "Brand name from the website",
  "url": "${scraped.baseUrl}",
  "colors": {
    "primary": "#hexcode — the dominant brand color",
    "secondary": "#hexcode — secondary brand color",
    "accent": "#hexcode — accent/CTA color"
  },
  "fonts": ["Primary font name", "Secondary font name if any"],
  "logoUrl": "URL of the logo image or null",
  "productImages": ["URL of product photo 1", "URL of product photo 2"],
  "lifestyleImages": ["URL of lifestyle/editorial image 1"],
  "toneOfVoice": "Precise description: formal/casual, tutoiement/vouvoiement, technical/accessible, emotional tone. Example: 'Casual and warm, uses tutoiement, emphasis on community and authenticity'",
  "language": "fr or en (primary language detected)",
  "keyBenefits": ["Specific benefit 1", "Specific benefit 2", "Specific benefit 3"],
  "personas": ["Detailed persona 1 description with age range, lifestyle, pain points"],
  "brandVoice": "2-3 sentence description of how this brand communicates. What makes their voice unique?",
  "forbiddenWords": ["word1", "word2 — words that would feel off-brand"],
  "productCategory": "One of: skincare, food, fashion, tech, fitness, home, beauty, health, pet, other",

  "brandArchetype": "One of: Hero | Outlaw | Sage | Lover | Jester | Innocent | Creator | Caregiver | Ruler | Explorer | Magician | Regular — choose the single best fit",
  "pricePositioning": "One of: budget | mid-range | premium | ultra-premium",
  "targetMarkets": ["Country or market this brand targets, e.g. France, US, Europe"],
  "competitorBrands": ["Competitor brand name 1", "Competitor brand name 2"],
  "differentiators": ["What makes this brand unique vs competitors — be specific"],

  "brandVoiceAdjectives": ["bold", "playful", "trustworthy — max 6 adjectives describing the brand voice"],
  "mandatoryMentions": ["Always mention this — e.g. legal claim, core promise"],
  "messagingHierarchy": ["Primary message (most important)", "Secondary message", "Tertiary message"],
  "callToActionExamples": ["Shop now", "Discover the collection — CTAs that fit this brand"],

  "visualStyleKeywords": ["minimalist", "editorial", "luxury — keywords describing their visual aesthetic"],
  "creativeDoList": ["Use natural lighting", "Show product in context — what works for this brand"],
  "creativeDontList": ["Avoid stock photo feel", "Never use white backgrounds — what to avoid"],
  "preferredHooks": ["pain", "social_proof", "benefice_direct — from: pain | curiosite | social_proof | fomo | benefice_direct | autorite | urgence"],
  "avoidedHooks": ["fomo", "urgence — hooks that feel off-brand"],

  "customerReviewsVerbatim": ["Exact quote a real customer might say (max 30 words) — max 10"],
  "customerPainPoints": ["Pain point 1 your customers feel before discovering this brand"],
  "customerDesiredOutcome": "The single outcome customers most want from this product",
  "customerObjections": ["Objection 1 — why someone might hesitate to buy"]
}

CRITICAL RULES:
1. Return ONLY the JSON object — no preamble, no explanation, no markdown fences
2. All hex colors MUST start with # and be valid 6-digit hex codes
3. Use actual colors from the CSS/content — do NOT invent colors (use "#000000" as fallback)
4. URLs must be absolute (https://...)
5. keyBenefits must be specific to THIS brand, not generic marketing language
6. personas must be detailed enough to write ad copy (age range, lifestyle, pain points)
7. If you cannot confidently extract a new field from the content, OMIT it — do NOT guess`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse the JSON response
  try {
    const cleaned = text
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();
    const dna = JSON.parse(cleaned) as ExtractedBrandDNA;

    // Merge scraped icons (not derived by Claude — direct from scraper)
    if (allIcons.length > 0) {
      dna.icons = allIcons;
    }

    // Merge Trustpilot verbatims into customerReviewsVerbatim (deduplicated)
    if (trustpilotVerbatims.length > 0) {
      const existing = dna.customerReviewsVerbatim ?? [];
      const merged = [...existing, ...trustpilotVerbatims].slice(0, 10);
      dna.customerReviewsVerbatim = [...new Set(merged)];
    }

    return dna;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 500)}`);
  }
}
