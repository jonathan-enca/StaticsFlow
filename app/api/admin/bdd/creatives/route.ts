// GET /api/admin/bdd/creatives
// Admin-only: returns paginated Template records with optional filters.
// Query params:
//   category   — filter by product category
//   type       — filter by creative type
//   hookType   — filter by hook type
//   language   — filter by language
//   analyzed   — "true" | "false" — filter by analysis status
//   page       — page number (default 1)
//   limit      — items per page (default 50, max 200)

import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { searchParams } = req.nextUrl;

  const category = searchParams.get("category") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const hookType = searchParams.get("hookType") ?? undefined;
  const language = searchParams.get("language") ?? undefined;
  const analyzed = searchParams.get("analyzed");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10))
  );

  // Build Prisma where clause
  const where: Prisma.TemplateWhereInput = {};
  if (category) where.category = category;
  if (type) where.type = type;
  if (hookType) where.hookType = hookType;
  if (language) where.language = language;
  if (analyzed === "true") where.analyzedAt = { not: null };
  if (analyzed === "false") where.analyzedAt = null;

  const [total, templates] = await Promise.all([
    prisma.template.count({ where }),
    prisma.template.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        category: true,
        type: true,
        layout: true,
        hookType: true,
        palette: true,
        language: true,
        sourceImageUrl: true,
        thumbnailUrl: true,
        analyzedAt: true,
        uploadedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    templates,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}
