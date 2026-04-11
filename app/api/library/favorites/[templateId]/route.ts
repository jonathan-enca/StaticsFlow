// POST   /api/library/favorites/[templateId] — add favorite
// DELETE /api/library/favorites/[templateId] — remove favorite
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ templateId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;

  // Verify template exists
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Upsert — idempotent
  await prisma.userFavorite.upsert({
    where: { userId_templateId: { userId: session.user.id, templateId } },
    create: { userId: session.user.id, templateId },
    update: {},
  });

  return NextResponse.json({ favorited: true }, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;

  await prisma.userFavorite.deleteMany({
    where: { userId: session.user.id, templateId },
  });

  return NextResponse.json({ favorited: false }, { status: 200 });
}
