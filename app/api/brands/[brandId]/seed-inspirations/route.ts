// POST /api/brands/[brandId]/seed-inspirations
// Auto-seeds the brand's inspiration library with BDD templates matching productCategory.
// Idempotent: only seeds if the brand has 0 inspirations (cold-start only).
// Called automatically during onboarding after Brand DNA extraction.
// STA-139: P0-B — eliminates the inspiration cold-start problem.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_CATEGORIES = [
  "skincare", "food", "fashion", "tech", "fitness",
  "home", "beauty", "health", "pet", "other",
] as const;
type TemplateCategory = (typeof VALID_CATEGORIES)[number];

// Keyword map for fuzzy category normalization.
// Order matters: more specific categories (skincare before beauty) come first.
const CATEGORY_KEYWORDS: Record<TemplateCategory, string[]> = {
  skincare: ["skincare", "skin care", "serum", "moisturiz", "moisturis", "sunscreen", "spf", "acne", "anti-aging", "anti-ageing", "retinol", "glow", "complexion"],
  food:     ["food", "drink", "beverage", "coffee", "tea", "snack", "nutrition", "organic food", "recipe", "culinary", "grocery"],
  fashion:  ["fashion", "clothing", "apparel", "shoes", "footwear", "accessories", "wear", "style", "outfit", "dress", "collection", "denim", "wardrobe", "capsule"],
  tech:     ["tech", "software", "app", "saas", "device", "gadget", "electronics", "ai ", "digital", "hardware", "startup"],
  fitness:  ["fitness", "gym", "workout", "sport", "athletic", "training", "yoga", "pilates", "running"],
  home:     ["home", "furniture", "decor", "interior", "living", "kitchen", "bedroom", "outdoor", "garden", "house"],
  beauty:   ["beauty", "makeup", "cosmetics", "lipstick", "mascara", "foundation", "blush", "eyeshadow", "fragrance", "perfume", "nail"],
  health:   ["health", "wellness", "medical", "pharma", "vitamin", "supplement", "pharmacy", "dental", "clinic"],
  pet:      ["pet", "dog", "cat", " animal", "veterinary", "paw", "fur"],
  other:    [],
};

export function normalizeCategoryForBDD(productCategory: string): TemplateCategory {
  const lower = productCategory.toLowerCase();
  for (const cat of VALID_CATEGORIES) {
    if (cat === "other") continue;
    const keywords = CATEGORY_KEYWORDS[cat];
    if (keywords.some((kw) => lower.includes(kw))) {
      return cat;
    }
  }
  return "other";
}

/**
 * Core seeding logic — reused by both this route and /api/brands/extract.
 * Queries BDD templates by category + language, seeds up to `count` Inspirations.
 * Safe to call multiple times: skips brands that already have inspirations.
 */
export async function seedInspirations(
  brandId: string,
  productCategory: string,
  language: string,
  count = 8
): Promise<{ seeded: number; category: TemplateCategory; alreadySeeded: boolean }> {
  // Idempotency: skip if the brand already has inspirations
  const existingCount = await prisma.inspiration.count({ where: { brandId } });
  if (existingCount > 0) {
    return { seeded: 0, category: normalizeCategoryForBDD(productCategory), alreadySeeded: true };
  }

  const category = normalizeCategoryForBDD(productCategory);
  const lang = (language ?? "fr").toLowerCase().slice(0, 2); // normalize "fr", "en", "de"

  // Priority 1: category + language match
  let templates = await prisma.template.findMany({
    where: { category, language: lang, analyzedAt: { not: null } },
    orderBy: { uploadedAt: "desc" },
    take: count,
    select: { id: true, sourceImageUrl: true, thumbnailUrl: true, analysisJson: true },
  });

  // Priority 2: category match, any language
  if (templates.length < count) {
    const moreIds = templates.map((t) => t.id);
    const more = await prisma.template.findMany({
      where: {
        category,
        analyzedAt: { not: null },
        id: { notIn: moreIds },
      },
      orderBy: { uploadedAt: "desc" },
      take: count - templates.length,
      select: { id: true, sourceImageUrl: true, thumbnailUrl: true, analysisJson: true },
    });
    templates = [...templates, ...more];
  }

  // Priority 3: any analyzed template (any category)
  if (templates.length < Math.min(count, 3)) {
    const moreIds = templates.map((t) => t.id);
    const fallback = await prisma.template.findMany({
      where: { analyzedAt: { not: null }, id: { notIn: moreIds } },
      orderBy: { uploadedAt: "desc" },
      take: count - templates.length,
      select: { id: true, sourceImageUrl: true, thumbnailUrl: true, analysisJson: true },
    });
    templates = [...templates, ...fallback];
  }

  if (templates.length === 0) {
    return { seeded: 0, category, alreadySeeded: false };
  }

  // Create Inspiration records (copy sourceImageUrl + analysisJson from Template)
  const result = await prisma.inspiration.createMany({
    data: templates.map((t) => ({
      brandId,
      imageUrl: t.sourceImageUrl,
      thumbnailUrl: t.thumbnailUrl ?? null,
      analysisJson: t.analysisJson ?? {},
      isActive: true,
      analyzedAt: new Date(), // Templates are pre-analyzed
    })),
    skipDuplicates: true,
  });

  return { seeded: result.count, category, alreadySeeded: false };
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
    select: { id: true, brandDnaJson: true },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const dna = brand.brandDnaJson as Record<string, unknown>;
  const productCategory = (dna?.productCategory as string) ?? "other";
  const language = (dna?.language as string) ?? "fr";

  const result = await seedInspirations(brandId, productCategory, language);

  const categoryLabel = result.category === "other" ? "" : result.category;
  const message = result.alreadySeeded
    ? "Inspiration library already seeded."
    : result.seeded > 0
    ? `We pre-loaded ${result.seeded} top-performing${categoryLabel ? ` ${categoryLabel}` : ""} ads as inspiration.`
    : "No matching templates found in the BDD yet.";

  return NextResponse.json(
    { seeded: result.seeded, category: result.category, message, alreadySeeded: result.alreadySeeded },
    { status: 200 }
  );
}
