// GET    /api/brands/[brandId]/products/[productId] — get a single product
// PATCH  /api/brands/[brandId]/products/[productId] — update product (full Product DNA v2 fields)
// DELETE /api/brands/[brandId]/products/[productId] — delete a product
// Auth required — user must own the brand.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function resolveProduct(userId: string, brandId: string, productId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return null;
  return prisma.product.findFirst({ where: { id: productId, brandId } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; productId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { brandId, productId } = await params;
  const product = await resolveProduct(session.user.id, brandId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json({ product });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; productId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { brandId, productId } = await params;
  const product = await resolveProduct(session.user.id, brandId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let body: {
    name?: string;
    description?: string;
    sourceUrl?: string;
    tagline?: string;
    price?: string;
    currency?: string;
    benefits?: string[];
    claims?: string[];
    ingredients?: string[];
    specsJson?: Record<string, string> | null;
    productImages?: string[];
    lifestyleImages?: string[];
    packagingImages?: string[];
    ugcImages?: string[];
    icons?: string[];
    reviewsVerbatim?: string[];
    reviewsSummary?: string | null;
    productSpecificCTAs?: string[];
    productSpecificHooks?: string[];
    avoidForThisProduct?: string[];
    isActive?: boolean;
    isDefault?: boolean;
    extractionStatus?: string;
    extractedAt?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // If setting as default, clear the current default on other products
  if (body.isDefault === true) {
    await prisma.product.updateMany({
      where: { brandId, isDefault: true, id: { not: productId } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() ?? null } : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: body.sourceUrl?.trim() ?? null } : {}),
      ...(body.tagline !== undefined ? { tagline: body.tagline?.trim() ?? null } : {}),
      ...(body.price !== undefined ? { price: body.price?.trim() ?? null } : {}),
      ...(body.currency !== undefined ? { currency: body.currency?.trim() ?? null } : {}),
      ...(body.benefits !== undefined ? { benefits: body.benefits } : {}),
      ...(body.claims !== undefined ? { claims: body.claims } : {}),
      ...(body.ingredients !== undefined ? { ingredients: body.ingredients } : {}),
      ...(body.specsJson !== undefined ? { specsJson: body.specsJson ?? undefined } : {}),
      ...(body.productImages !== undefined ? { productImages: body.productImages } : {}),
      ...(body.lifestyleImages !== undefined ? { lifestyleImages: body.lifestyleImages } : {}),
      ...(body.packagingImages !== undefined ? { packagingImages: body.packagingImages } : {}),
      ...(body.ugcImages !== undefined ? { ugcImages: body.ugcImages } : {}),
      ...(body.icons !== undefined ? { icons: body.icons } : {}),
      ...(body.reviewsVerbatim !== undefined ? { reviewsVerbatim: body.reviewsVerbatim } : {}),
      ...(body.reviewsSummary !== undefined ? { reviewsSummary: body.reviewsSummary ?? null } : {}),
      ...(body.productSpecificCTAs !== undefined ? { productSpecificCTAs: body.productSpecificCTAs } : {}),
      ...(body.productSpecificHooks !== undefined ? { productSpecificHooks: body.productSpecificHooks } : {}),
      ...(body.avoidForThisProduct !== undefined ? { avoidForThisProduct: body.avoidForThisProduct } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      ...(body.extractionStatus !== undefined ? { extractionStatus: body.extractionStatus } : {}),
      ...(body.extractedAt !== undefined ? { extractedAt: new Date(body.extractedAt) } : {}),
    },
  });

  return NextResponse.json({ product: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; productId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { brandId, productId } = await params;
  const product = await resolveProduct(session.user.id, brandId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await prisma.product.delete({ where: { id: productId } });
  return NextResponse.json({ ok: true });
}
