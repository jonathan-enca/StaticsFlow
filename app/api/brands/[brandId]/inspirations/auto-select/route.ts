// POST /api/brands/[brandId]/inspirations/auto-select
// Claude picks the best inspiration from the brand library given a hook angle.
// Falls back to rule-based matching if no exact angle match.
// Auth required — user must own the brand.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface InspirationAnalysis {
  hookAngle?: string;
  layoutType?: string;
  adFormat?: string;
  analysisQualityScore?: number;
  mood?: string;
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

  // Verify ownership
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
    select: { id: true },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let angle: string | undefined;
  try {
    const body = await req.json();
    angle = body.angle;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Fetch all active, analyzed inspirations for this brand
  const inspirations = await prisma.inspiration.findMany({
    where: {
      brandId,
      isActive: true,
      analyzedAt: { not: null },
    },
    select: { id: true, analysisJson: true },
  });

  if (inspirations.length === 0) {
    return NextResponse.json({ inspirationId: null }, { status: 200 });
  }

  // Rule-based matching — no extra LLM call needed:
  // 1. Exact hookAngle match (highest analysisQualityScore wins)
  // 2. Any analyzed inspiration with a score (fallback)

  type Scored = { id: string; score: number };
  const exactMatches: Scored[] = [];
  const fallbacks: Scored[] = [];

  for (const ins of inspirations) {
    const a = ins.analysisJson as InspirationAnalysis | null;
    if (!a) continue;
    const qScore = a.analysisQualityScore ?? 0.5;

    if (angle && a.hookAngle?.toLowerCase() === angle.toLowerCase()) {
      exactMatches.push({ id: ins.id, score: qScore });
    } else {
      fallbacks.push({ id: ins.id, score: qScore });
    }
  }

  // Sort by score descending, pick the best
  const sortDesc = (arr: Scored[]) => arr.sort((a, b) => b.score - a.score);
  const sorted = sortDesc(exactMatches).length > 0
    ? sortDesc(exactMatches)
    : sortDesc(fallbacks);

  const best = sorted[0] ?? null;
  return NextResponse.json({ inspirationId: best?.id ?? null }, { status: 200 });
}
