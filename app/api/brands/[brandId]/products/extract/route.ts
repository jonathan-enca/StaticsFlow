// POST /api/brands/[brandId]/products/extract
// Extracts Product DNA from a URL: scrapes page → Claude analysis → returns structured data
// Does NOT save to DB — client previews and confirms before saving.
// Auth required — user must own the brand and have a valid Claude API key.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClaudeClient, CLAUDE_MODEL } from "@/lib/claude";
import { scrapeWebsite } from "@/lib/scraper";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";

export const maxDuration = 120; // Scraping + Claude can take 60–90s

interface ProductExtractionResult {
  name: string;
  tagline: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  benefits: string[];
  claims: string[];
  ingredients: string[];
  productImages: string[];      // packshots
  lifestyleImages: string[];
  packagingImages: string[];
  ugcImages: string[];
  reviewsVerbatim: string[];
  reviewsSummary: string | null;
  productSpecificCTAs: string[];
  productSpecificHooks: string[];
  extractionNotes: string | null; // Claude notes on extraction quality
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let body: { url: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Get user's Claude API key (BYOK)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicApiKey: true },
  });
  const anthropicApiKey = user?.anthropicApiKey ?? undefined;

  // Step 1 — Scrape the product page
  let scrapeResult;
  try {
    scrapeResult = await scrapeWebsite(body.url.trim());
  } catch (err) {
    console.error("[product/extract] Scrape failed:", err);
    return NextResponse.json(
      { error: "scrape_failed", message: "Could not load the product page. Try again or fill the form manually." },
      { status: 422 }
    );
  }

  const pageTexts = scrapeResult.pages.map((p) => p.bodyText).join("\n\n---\n\n");
  const allImages = scrapeResult.pages.flatMap((p) => p.images);

  // Step 2 — Claude analysis
  const claude = createClaudeClient(anthropicApiKey);

  const prompt = `You are a product intelligence analyst. Analyze the following product page content and extract structured Product DNA data.

Product URL: ${body.url}

Page content:
${pageTexts.slice(0, 12000)}

All image URLs found on page:
${allImages.slice(0, 30).join("\n")}

Extract and return a JSON object with these exact fields:
{
  "name": "Product name (required)",
  "tagline": "Short 1-line product promise or null",
  "description": "Full product description or null",
  "price": "Price with currency symbol e.g. €49.90 or null",
  "currency": "ISO currency code EUR/USD/GBP/etc. or null",
  "benefits": ["list of specific product benefits, min 2 if available"],
  "claims": ["certifications, proofs: Dermatologist tested, SPF50, Vegan, etc."],
  "ingredients": ["key active ingredients if applicable"],
  "productImages": ["URLs of product packshots/product photos — prioritize clean product-on-white or product-focused shots"],
  "lifestyleImages": ["URLs of lifestyle or in-context shots showing product in use"],
  "packagingImages": ["URLs of packaging-focused shots"],
  "ugcImages": [],
  "reviewsVerbatim": ["up to 5 real customer quotes found on page, keep exact wording"],
  "reviewsSummary": "1-2 sentence synthesis of customer sentiment or null",
  "productSpecificCTAs": ["CTAs found: Buy Now, Shop X, Try Free, etc."],
  "productSpecificHooks": ["marketing angles detected: transformation, problem/solution, social proof, urgency, etc."],
  "extractionNotes": "Brief note on extraction quality and any limitations or null"
}

Rules:
- Return ONLY valid JSON, no markdown, no prose
- For image URLs: only include absolute URLs (starting with http), omit relative paths
- If a field cannot be extracted, use null or [] as appropriate
- benefits and claims are different: benefits are outcomes ("reduces wrinkles"), claims are proofs ("Clinically tested")
- productImages should have the highest-confidence product shots (not logos, not icons)
- Limit productImages to max 8 URLs, lifestyleImages to max 5, packagingImages to max 3`;

  let extraction: ProductExtractionResult;
  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content.find((b) => b.type === "text") as TextBlock | undefined)?.text ?? "";
    // Strip markdown code fences if present
    const json = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    extraction = JSON.parse(json);
  } catch (err) {
    console.error("[product/extract] Claude analysis failed:", err);
    return NextResponse.json(
      { error: "analysis_failed", message: "Could not analyze the product page. Try again or fill the form manually." },
      { status: 422 }
    );
  }

  return NextResponse.json({ extraction, sourceUrl: body.url });
}
