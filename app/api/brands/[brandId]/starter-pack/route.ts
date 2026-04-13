// POST /api/brands/[brandId]/starter-pack
// Copies selected BDD templates into the brand's inspiration library.
// Body: { templateIds: string[] }
// Auth required — user must own the brand.
// Creates Inspiration records pointing to the same R2 URLs as the templates (no re-upload needed).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    select: { id: true },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let templateIds: string[];
  try {
    const body = await req.json();
    templateIds = body.templateIds;
    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      throw new Error("templateIds must be a non-empty array");
    }
  } catch {
    return NextResponse.json({ error: "Invalid body: templateIds is required" }, { status: 400 });
  }

  // Clamp to max 12 (one starter pack)
  const ids = templateIds.slice(0, 12);

  // Fetch the templates
  const templates = await prisma.template.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sourceImageUrl: true,
      thumbnailUrl: true,
      analysisJson: true,
    },
  });

  if (templates.length === 0) {
    return NextResponse.json({ error: "No valid templates found" }, { status: 404 });
  }

  // Check current inspiration count — don't exceed 50
  const currentCount = await prisma.inspiration.count({ where: { brandId } });
  const canAdd = Math.max(0, 50 - currentCount);
  const toAdd = templates.slice(0, canAdd);

  if (toAdd.length === 0) {
    return NextResponse.json(
      { error: "Inspiration library is full (50 max). Remove some before adding a starter pack." },
      { status: 400 }
    );
  }

  // Create Inspiration records (already analyzed — copy analysisJson from template)
  const created = await prisma.inspiration.createMany({
    data: toAdd.map((t) => ({
      brandId,
      imageUrl: t.sourceImageUrl,
      thumbnailUrl: t.thumbnailUrl ?? null,
      analysisJson: t.analysisJson ?? {},
      isActive: true,
      analyzedAt: new Date(), // Templates are pre-analyzed
    })),
    skipDuplicates: true,
  });

  return NextResponse.json(
    { added: created.count, total: currentCount + created.count },
    { status: 201 }
  );
}
