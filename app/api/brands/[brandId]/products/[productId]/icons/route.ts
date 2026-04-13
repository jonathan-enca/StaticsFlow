// POST /api/brands/[brandId]/products/[productId]/icons
// Uploads one or more icon/UI element images to R2 and appends their URLs to product.iconsAndUiElements.
// DELETE /api/brands/[brandId]/products/[productId]/icons — remove a specific icon URL
// Auth required — user must own the brand.
// Body (POST): multipart/form-data — one or more "file" fields
// Body (DELETE): JSON { url: string }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, productAssetKey } from "@/lib/r2";
import { randomUUID } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };
  return map[mime] ?? "png";
}

async function resolveProduct(userId: string, brandId: string, productId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return null;
  return prisma.product.findFirst({ where: { id: productId, brandId } });
}

export async function POST(
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = formData.getAll("file") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "At least one file field is required" }, { status: 400 });
  }

  const uploadedUrls: string[] = [];
  for (const file of files) {
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME.join(", ")}` },
        { status: 400 }
      );
    }
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (max 5 MB): ${file.name}` }, { status: 400 });
    }
    const ext = extFromMime(file.type);
    const key = productAssetKey(session.user.id, brandId, productId, "icons", randomUUID(), ext);
    const url = await uploadToR2(key, Buffer.from(bytes), file.type);
    uploadedUrls.push(url);
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { iconsAndUiElements: { push: uploadedUrls } },
  });

  return NextResponse.json({ iconsAndUiElements: updated.iconsAndUiElements, uploaded: uploadedUrls }, { status: 200 });
}

export async function DELETE(
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

  let body: { url: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { iconsAndUiElements: product.iconsAndUiElements.filter((u) => u !== body.url) },
  });

  return NextResponse.json({ iconsAndUiElements: updated.iconsAndUiElements });
}
