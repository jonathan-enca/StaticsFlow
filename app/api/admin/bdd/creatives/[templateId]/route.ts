// PATCH /api/admin/bdd/creatives/[templateId]
// Admin-only: update analysis fields for a template (manual review/correction).
// Body: { category, type, layout, hookType, palette, language }

import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const VALID_CATEGORIES = [
  "skincare","food","fashion","tech","fitness","home","beauty","health","pet","other",
];
const VALID_TYPES = [
  "product_hero","before_after","comparatif","testimonial","promo",
  "ugc_screenshot","lifestyle","data_stats","listicle","press_mention",
];
const VALID_LAYOUTS = ["grid","split","centered","overlay","other"];
const VALID_HOOKS = [
  "pain","curiosite","social_proof","fomo","benefice_direct","autorite","urgence",
];
const VALID_LANGUAGES = ["fr","en","de","other"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { templateId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate + sanitize each field (only update fields that are provided)
  const data: Record<string, unknown> = {};

  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.includes(body.category as string)) {
      return NextResponse.json({ error: `Invalid category: ${body.category}` }, { status: 400 });
    }
    data.category = body.category;
  }
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type as string)) {
      return NextResponse.json({ error: `Invalid type: ${body.type}` }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.layout !== undefined) {
    if (!VALID_LAYOUTS.includes(body.layout as string)) {
      return NextResponse.json({ error: `Invalid layout: ${body.layout}` }, { status: 400 });
    }
    data.layout = body.layout;
  }
  if (body.hookType !== undefined) {
    if (!VALID_HOOKS.includes(body.hookType as string)) {
      return NextResponse.json({ error: `Invalid hookType: ${body.hookType}` }, { status: 400 });
    }
    data.hookType = body.hookType;
  }
  if (body.language !== undefined) {
    if (!VALID_LANGUAGES.includes(body.language as string)) {
      return NextResponse.json({ error: `Invalid language: ${body.language}` }, { status: 400 });
    }
    data.language = body.language;
  }
  if (body.palette !== undefined) {
    if (
      !Array.isArray(body.palette) ||
      !(body.palette as string[]).every((c) => /^#[0-9a-fA-F]{6}$/.test(c))
    ) {
      return NextResponse.json({ error: "Invalid palette: must be array of hex colors" }, { status: 400 });
    }
    data.palette = (body.palette as string[]).slice(0, 4); // allow 0–4 colors
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const updated = await prisma.template.update({
    where: { id: templateId },
    data,
  });

  return NextResponse.json({ template: updated });
}
