// GET /api/admin/users/[userId]/brands
// Returns all brands for a given user with counts (products, creatives).
// Admin-only — protected by adminGuard().

import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { userId } = await params;

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, plan: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const brands = await prisma.brand.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          products: true,
          creatives: true,
          inspirations: true,
        },
      },
    },
  });

  return NextResponse.json({ user, brands });
}
