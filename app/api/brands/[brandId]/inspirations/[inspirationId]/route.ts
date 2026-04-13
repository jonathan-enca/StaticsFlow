// PATCH  /api/brands/[brandId]/inspirations/[inspirationId] — toggle isActive
// DELETE /api/brands/[brandId]/inspirations/[inspirationId] — delete inspiration + R2 objects
// Auth required — user must own the brand.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, inspirationKey, inspirationThumbKey } from "@/lib/r2";

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; inspirationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId, inspirationId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const inspiration = await prisma.inspiration.findFirst({
    where: { id: inspirationId, brandId },
  });
  if (!inspiration) {
    return NextResponse.json({ error: "Inspiration not found" }, { status: 404 });
  }

  let body: { isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updated = await prisma.inspiration.update({
    where: { id: inspirationId },
    data: {
      ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({ inspiration: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; inspirationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId, inspirationId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const inspiration = await prisma.inspiration.findFirst({
    where: { id: inspirationId, brandId },
  });
  if (!inspiration) {
    return NextResponse.json({ error: "Inspiration not found" }, { status: 404 });
  }

  // Remove R2 objects (best effort — don't fail the delete if R2 removal fails)
  const ext = inspiration.imageUrl.split(".").pop() ?? "jpg";
  const imageR2Key = inspirationKey(session.user.id, brandId, inspirationId, ext);
  const thumbR2Key = inspirationThumbKey(session.user.id, brandId, inspirationId);

  await Promise.allSettled([
    deleteFromR2(imageR2Key),
    deleteFromR2(thumbR2Key),
  ]);

  await prisma.inspiration.delete({ where: { id: inspirationId } });

  return NextResponse.json({ ok: true });
}
