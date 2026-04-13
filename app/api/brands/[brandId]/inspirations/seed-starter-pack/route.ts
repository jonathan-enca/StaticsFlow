// POST /api/brands/[brandId]/inspirations/seed-starter-pack
// Seeds a brand's inspirations library from the global Template table,
// filtered by the provided category (or "all" for category-agnostic seeding).
//
// Used during onboarding: new user picks a category → gets 10–15 pre-analyzed
// inspirations seeded into their brand library, skipping the manual upload step.
//
// Rules:
//   - Only seeds if the brand has fewer than 5 active inspirations (idempotent-safe)
//   - Copies Template.sourceImageUrl + analysisJson into brand Inspirations
//   - Max 15 templates seeded per call
//   - Auth required — user must own the brand

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_SEED_COUNT = 15;
const MIN_FOR_SKIP = 5; // skip if brand already has >= 5 active inspirations

const VALID_CATEGORIES = new Set([
  "skincare", "food", "fashion", "tech", "fitness", "beauty",
  "health", "home", "pet", "other",
]);

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

  let body: { category?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const category = body.category?.toLowerCase();
  if (category && category !== "all" && !VALID_CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: "invalid_category", message: `Unknown category: ${category}` },
      { status: 400 }
    );
  }

  // Check existing active inspirations — skip if already seeded
  const existingCount = await prisma.inspiration.count({
    where: { brandId, isActive: true },
  });
  if (existingCount >= MIN_FOR_SKIP) {
    return NextResponse.json({
      skipped: true,
      message: `Brand already has ${existingCount} active inspirations. Seeding skipped.`,
      seeded: 0,
    });
  }

  // Fetch templates from global BDD, filtered by category
  const whereClause = category && category !== "all"
    ? { category, analyzedAt: { not: null } }
    : { analyzedAt: { not: null } };

  const templates = await prisma.template.findMany({
    where: whereClause,
    orderBy: { uploadedAt: "desc" },
    take: MAX_SEED_COUNT,
    select: {
      id: true,
      sourceImageUrl: true,
      thumbnailUrl: true,
      analysisJson: true,
    },
  });

  if (templates.length === 0) {
    return NextResponse.json({
      skipped: false,
      seeded: 0,
      message: "No templates available for this category yet.",
    });
  }

  // Bulk-create inspirations from templates
  // Use createMany with skipDuplicates to be safe on retries
  await prisma.inspiration.createMany({
    data: templates.map((t) => ({
      brandId,
      imageUrl: t.sourceImageUrl,
      thumbnailUrl: t.thumbnailUrl ?? null,
      analysisJson: t.analysisJson as object,
      analyzedAt: new Date(), // templates are pre-analyzed
      isActive: true,
    })),
    skipDuplicates: false,
  });

  return NextResponse.json({
    skipped: false,
    seeded: templates.length,
    message: `Seeded ${templates.length} inspirations from the ${category ?? "global"} library.`,
  });
}
