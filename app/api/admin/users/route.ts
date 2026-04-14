// GET /api/admin/users — list all users (paginated + searchable)
// PATCH /api/admin/users — handled in [userId]/route.ts
// Protected by adminGuard()

import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10)));
  const q = (searchParams.get("q") ?? "").trim();
  const plan = searchParams.get("plan") ?? "all";

  const where: Prisma.UserWhereInput = {};

  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }

  if (plan !== "all") {
    where.plan = plan as "STARTER" | "PRO" | "AGENCY";
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        plan: true,
        isAdmin: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
        // counts via _count
        _count: {
          select: {
            brands: true,
            sessions: true,
          },
        },
        // last brand for quick context
        brands: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { name: true, url: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    users,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}
