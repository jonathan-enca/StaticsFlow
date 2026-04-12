// GET /api/library
// Paginated listing of analyzed inspiration templates.
// Accessible to all authenticated users (read-only, only analyzed templates).
// Query params:
//   category   — filter
//   type       — filter
//   hookType   — filter
//   language   — filter
//   favorites  — "true" — only return templates favorited by the current user
//   page       — page number (default 1)
//   limit      — items per page (default 48, max 100)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const hookType = searchParams.get("hookType") ?? undefined;
  const language = searchParams.get("language") ?? undefined;
  const favoritesOnly = searchParams.get("favorites") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "48", 10)));

  // Base filter: show all uploaded templates (analysis enriches metadata but
  // unanalyzed templates still have sensible defaults and should be visible)
  const where: Prisma.TemplateWhereInput = {
    ...(category && { category }),
    ...(type && { type }),
    ...(hookType && { hookType }),
    ...(language && { language }),
    ...(favoritesOnly && {
      favorites: {
        some: { userId: session.user.id },
      },
    }),
  };

  // Fetch templates and user's favorite IDs in parallel
  const [total, templates, userFavorites] = await Promise.all([
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
        thumbnailUrl: true,
        sourceImageUrl: true,
        uploadedAt: true,
      },
    }),
    // Return all favorited IDs for this user (not just current page)
    // so the client can mark hearts without re-fetching
    prisma.userFavorite.findMany({
      where: { userId: session.user.id },
      select: { templateId: true },
    }),
  ]);

  const favoriteIds = new Set(userFavorites.map((f) => f.templateId));

  // Attach isFavorited flag to each template
  const enrichedTemplates = templates.map((t) => ({
    ...t,
    isFavorited: favoriteIds.has(t.id),
  }));

  return NextResponse.json({
    templates: enrichedTemplates,
    favoriteIds: [...favoriteIds],
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}
