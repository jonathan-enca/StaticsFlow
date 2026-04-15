// GET /api/brands/[brandId]  — returns full brand record
// DELETE /api/brands/[brandId] — deletes brand and all related data (cascades via Prisma)

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

  return NextResponse.json({ brand }, { status: 200 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  // Verify ownership before deleting
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
    select: { id: true },
  });

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Cascade deletes (creatives, products, inspirations, batches) are handled
  // by the Prisma schema's onDelete: Cascade relations.
  await prisma.brand.delete({ where: { id: brandId } });

  return NextResponse.json({ success: true }, { status: 200 });
}
