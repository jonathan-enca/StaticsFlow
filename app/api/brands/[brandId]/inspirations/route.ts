// POST /api/brands/[brandId]/inspirations — upload a new inspiration image
// GET  /api/brands/[brandId]/inspirations — list all inspirations for a brand
// Auth required — user must own the brand.
//
// Upload constraints (spec Section 3):
//   - Accepted formats: JPEG, PNG, WebP
//   - Max file size: 10 MB
//   - Min dimensions: 400x400 px
//   - Max per brand: 50
//   - Dedup via SHA-256 hash of file bytes

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, inspirationKey, inspirationThumbKey } from "@/lib/r2";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PER_BRAND = 50;
const MIN_DIMENSION = 400;
const THUMB_SIZE = 400; // thumbnail max dimension (px)
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ─── GET ──────────────────────────────────────────────────────────────────────

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

  const inspirations = await prisma.inspiration.findMany({
    where: { brandId },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json({ inspirations, total: inspirations.length });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
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

  // Check brand inspiration cap
  const existingCount = await prisma.inspiration.count({ where: { brandId } });
  if (existingCount >= MAX_PER_BRAND) {
    return NextResponse.json(
      { error: "inspiration_limit_reached", message: `Maximum ${MAX_PER_BRAND} inspirations per brand.` },
      { status: 422 }
    );
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }

  // Type check
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "invalid_type", message: "Only JPEG, PNG, and WebP files are accepted." },
      { status: 422 }
    );
  }

  // Size check
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "File exceeds the 10 MB limit." },
      { status: 422 }
    );
  }

  // Dimension check via sharp
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return NextResponse.json(
      { error: "invalid_image", message: "Could not read image metadata." },
      { status: 422 }
    );
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return NextResponse.json(
      {
        error: "too_small",
        message: `Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} px. Got ${width}×${height}.`,
      },
      { status: 422 }
    );
  }

  // Hash for deduplication
  const hash = createHash("sha256").update(buffer).digest("hex");

  const duplicate = await prisma.inspiration.findFirst({
    where: { brandId, imageHash: hash },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "duplicate", message: "This image has already been uploaded.", inspirationId: duplicate.id },
      { status: 409 }
    );
  }

  // Create DB record (status: pending analysis)
  const inspiration = await prisma.inspiration.create({
    data: {
      brandId,
      imageUrl: "", // filled after R2 upload
      imageHash: hash,
      analysisJson: {},
    },
  });

  // Determine extension
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extMap[file.type] ?? "jpg";

  // Upload original to R2
  const imageR2Key = inspirationKey(session.user.id, brandId, inspiration.id, ext);
  let imageUrl: string;
  try {
    imageUrl = await uploadToR2(imageR2Key, buffer, file.type);
  } catch (err) {
    console.error("[inspirations] R2 upload failed:", err);
    await prisma.inspiration.delete({ where: { id: inspiration.id } });
    return NextResponse.json(
      { error: "upload_failed", message: "Could not store the image. Try again." },
      { status: 500 }
    );
  }

  // Generate thumbnail (max THUMB_SIZE px on longest side, JPEG)
  let thumbnailUrl: string | null = null;
  try {
    const thumbBuffer = await sharp(buffer)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbKey = inspirationThumbKey(session.user.id, brandId, inspiration.id);
    thumbnailUrl = await uploadToR2(thumbKey, thumbBuffer, "image/jpeg");
  } catch (err) {
    // Thumbnail failure is non-fatal — log and continue
    console.warn("[inspirations] Thumbnail generation failed:", err);
  }

  // Persist URLs
  const updated = await prisma.inspiration.update({
    where: { id: inspiration.id },
    data: { imageUrl, thumbnailUrl },
  });

  return NextResponse.json({ inspiration: updated }, { status: 201 });
}
