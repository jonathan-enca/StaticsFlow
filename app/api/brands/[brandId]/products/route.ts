// GET  /api/brands/[brandId]/products — list products for a brand
// POST /api/brands/[brandId]/products — create a new product (full Product DNA v2 fields)
// Auth required — user must own the brand.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: { brandId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ products });
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

  let body: {
    name: string;
    description?: string;
    sourceUrl?: string;
    tagline?: string;
    price?: string;
    currency?: string;
    benefits?: string[];
    claims?: string[];
    ingredients?: string[];
    specsJson?: Record<string, string>;
    productImages?: string[];
    lifestyleImages?: string[];
    packagingImages?: string[];
    ugcImages?: string[];
    icons?: string[];
    reviewsVerbatim?: string[];
    reviewsSummary?: string;
    productSpecificCTAs?: string[];
    productSpecificHooks?: string[];
    avoidForThisProduct?: string[];
    isDefault?: boolean;
    extractionStatus?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // If setting this as default, clear the current default first
  if (body.isDefault) {
    await prisma.product.updateMany({
      where: { brandId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const product = await prisma.product.create({
    data: {
      brandId,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      sourceUrl: body.sourceUrl?.trim() ?? null,
      tagline: body.tagline?.trim() ?? null,
      price: body.price?.trim() ?? null,
      currency: body.currency?.trim() ?? null,
      benefits: body.benefits ?? [],
      claims: body.claims ?? [],
      ingredients: body.ingredients ?? [],
      specsJson: body.specsJson ?? undefined,
      productImages: body.productImages ?? [],
      lifestyleImages: body.lifestyleImages ?? [],
      packagingImages: body.packagingImages ?? [],
      ugcImages: body.ugcImages ?? [],
      icons: body.icons ?? [],
      reviewsVerbatim: body.reviewsVerbatim ?? [],
      reviewsSummary: body.reviewsSummary?.trim() ?? null,
      productSpecificCTAs: body.productSpecificCTAs ?? [],
      productSpecificHooks: body.productSpecificHooks ?? [],
      avoidForThisProduct: body.avoidForThisProduct ?? [],
      isDefault: body.isDefault ?? false,
      extractionStatus: body.extractionStatus ?? "pending",
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
