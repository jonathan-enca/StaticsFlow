// GET /api/library/favorites
// Returns the set of template IDs favorited by the authenticated user.
// Lightweight — used on mount to restore heart state.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: session.user.id },
    select: { templateId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    favoriteIds: favorites.map((f) => f.templateId),
    count: favorites.length,
  });
}
