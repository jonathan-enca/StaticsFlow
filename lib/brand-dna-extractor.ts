// Brand DNA extraction: Claude analysis of scraped website content
// Returns a structured BrandDNA JSON (see types/index.ts)

import { createClaudeClient, CLAUDE_MODEL } from "@/lib/claude";
import { scrapeWebsite, ScrapeResult } from "@/lib/scraper";

export interface ExtractedBrandDNA {
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
  personas: string[];
  brandVoice: string;
  forbiddenWords: string[];
  productCategory: string;
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

async function analyzeBrandWithClaude(
  scraped: ScrapeResult,
  apiKey?: string
): Promise<ExtractedBrandDNA> {
  const client = createClaudeClient(apiKey);

  // Build a compact summary of scraped content to send to Claude
  const pagesContent = scraped.pages
    .map(
      (p, i) =>
        `=== Page ${i + 1}: ${p.url} ===\n` +
        `Title: ${p.title}\n` +
        `Description: ${p.description}\n` +
        `Body text (excerpt):\n${p.bodyText}\n` +
        `Images found: ${p.images.slice(0, 5).join(", ")}\n` +
        `Colors detected: ${p.colors.slice(0, 10).join(", ")}\n` +
        `Fonts detected: ${p.fonts.join(", ")}\n`
    )
    .join("\n\n");

  const prompt = `You are a senior creative director and brand strategist. Analyze the following website content and extract a complete Brand DNA profile.

WEBSITE URL: ${scraped.baseUrl}

SCRAPED CONTENT:
${pagesContent}

Extract the Brand DNA and return it as a valid JSON object with EXACTLY this structure. Be specific and concrete — generic answers like "modern" or "clean" are not acceptable:

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
  "toneOfVoice": "Describe precisely: formal/casual, tutoiement/vouvoiement, technical/accessible, emotional tone. Example: 'Casual and warm, uses tutoiement, emphasis on community and authenticity'",
  "language": "fr or en (primary language detected)",
  "keyBenefits": ["Specific benefit 1", "Specific benefit 2", "Specific benefit 3"],
  "personas": ["Detailed persona 1 description", "Detailed persona 2 description"],
  "brandVoice": "2-3 sentence description of how this brand communicates. What makes their voice unique?",
  "forbiddenWords": ["word1", "word2 — words that would feel off-brand"],
  "productCategory": "One of: skincare, food, fashion, tech, fitness, home, beauty, health, pet, other"
}

CRITICAL RULES:
1. Return ONLY the JSON object — no preamble, no explanation, no markdown fences
2. All hex colors MUST start with # and be valid 6-digit hex codes
3. Use actual colors from the CSS/content — do NOT invent colors if none found (use "#000000" as fallback)
4. URLs must be absolute (https://...)
5. keyBenefits should be specific to THIS brand, not generic marketing language
6. personas must be detailed enough to write ad copy for (age range, lifestyle, pain points)`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse the JSON response
  try {
    // Strip any accidental markdown fences
    const cleaned = text
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();
    return JSON.parse(cleaned) as ExtractedBrandDNA;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 500)}`);
  }
}
