// GET /api/starter-packs?category=skincare
// Returns curated BDD templates grouped by category — used for the "starter pack" picker on first login.
// Soft gate: if no templates exist for a category, returns all categories' latest templates (max 20).
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPPORTED_CATEGORIES = [
  "skincare", "food", "fashion", "tech", "fitness",
  "home", "beauty", "health", "pet", "other",
];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  if (category && !SUPPORTED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (category) {
    // Return up to 12 templates for the requested category
    const templates = await prisma.template.findMany({
      where: { category, analyzedAt: { not: null } },
      select: {
        id: true,
        category: true,
        type: true,
        hookType: true,
        thumbnailUrl: true,
        sourceImageUrl: true,
      },
      orderBy: { uploadedAt: "desc" },
      take: 12,
    });
    return NextResponse.json({ templates }, { status: 200 });
  }

  // No category: return category list with a preview image each
  const categoryPreviews = await Promise.all(
    SUPPORTED_CATEGORIES.map(async (cat) => {
      const sample = await prisma.template.findFirst({
        where: { category: cat, analyzedAt: { not: null } },
        select: { id: true, thumbnailUrl: true, sourceImageUrl: true },
        orderBy: { uploadedAt: "desc" },
      });
      return { category: cat, preview: sample ?? null };
    })
  );

  // Only return categories that have at least one template
  const populated = categoryPreviews.filter((c) => c.preview !== null);
  return NextResponse.json({ categories: populated }, { status: 200 });
}
