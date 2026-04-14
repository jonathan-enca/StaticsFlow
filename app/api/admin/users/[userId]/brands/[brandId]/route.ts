// GET   /api/admin/users/[userId]/brands/[brandId]
//   Returns full brand record (including brandDnaJson), products, and recent creatives.
// PATCH /api/admin/users/[userId]/brands/[brandId]
//   Merges fields into brandDnaJson (same payload shape as /api/brands/[brandId]/enrich).
// Admin-only — protected by adminGuard().

import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function getAdminBrand(userId: string, brandId: string) {
  return prisma.brand.findFirst({
    where: { id: brandId, userId },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; brandId: string }> }
) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { userId, brandId } = await params;

  const brand = await getAdminBrand(userId, brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const creativePage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const creativeLimit = 24;

  const [products, creatives, creativeCount] = await Promise.all([
    prisma.product.findMany({
      where: { brandId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        isDefault: true,
        isActive: true,
        extractionStatus: true,
        createdAt: true,
        _count: { select: { creatives: true } },
      },
    }),
    prisma.creative.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      skip: (creativePage - 1) * creativeLimit,
      take: creativeLimit,
      select: {
        id: true,
        imageUrl: true,
        status: true,
        score: true,
        format: true,
        angle: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.creative.count({ where: { brandId } }),
  ]);

  return NextResponse.json({
    brand,
    products,
    creatives,
    creativePagination: {
      total: creativeCount,
      page: creativePage,
      limit: creativeLimit,
      pages: Math.ceil(creativeCount / creativeLimit),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; brandId: string }> }
) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { userId, brandId } = await params;

  const brand = await getAdminBrand(userId, brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const updates = await req.json();

  // Merge into existing brandDnaJson (shallow merge of top-level keys)
  const existing = (brand.brandDnaJson ?? {}) as Record<string, unknown>;
  const merged = { ...existing, ...updates };

  const updated = await prisma.brand.update({
    where: { id: brandId },
    data: { brandDnaJson: merged },
  });

  return NextResponse.json({ brand: updated });
}
