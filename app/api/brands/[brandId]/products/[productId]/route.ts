// GET    /api/brands/[brandId]/products/[productId] — get a single product
// PATCH  /api/brands/[brandId]/products/[productId] — update name / description
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

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() ?? null } : {}),
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
