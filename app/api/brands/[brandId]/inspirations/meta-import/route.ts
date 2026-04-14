// POST /api/brands/[brandId]/inspirations/meta-import
// Batch wrapper around the existing import-url pipeline.
// Accepts an array of image URLs (from meta-scrape) and imports each one.
//
// Key behavior:
//   - Silent dedup: duplicate SHA-256 → status "duplicate", no error surfaced to user
//   - Capacity check per iteration (respects MAX_PER_BRAND = 50)
//   - Returns per-URL results + summary { imported, duplicates, failed }

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, inspirationKey, inspirationThumbKey } from "@/lib/r2";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PER_BRAND = 50;
const MIN_DIMENSION = 400;
const THUMB_SIZE = 400;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function fetchImage(
  url: string
): Promise<{ buffer: Buffer; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; StaticsFlow/1.0; +https://staticsflow.com)",
        Accept: "image/*,*/*;q=0.8",
      },
    });
  } catch {
    throw new Error("Could not reach that URL.");
  }
  if (!response.ok) {
    throw new Error(`Server returned ${response.status}.`);
  }
  const rawType = response.headers.get("content-type") ?? "";
  const contentType = rawType.split(";")[0].trim().toLowerCase();
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

interface UrlResult {
  url: string;
  status: "imported" | "duplicate" | "failed";
  inspirationId?: string;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
    include: {
      products: { where: { isDefault: true, isActive: true }, select: { id: true }, take: 1 },
    },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Default product to auto-assign (null if brand has no default product)
  const defaultProductId = brand.products[0]?.id ?? null;

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: { urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with a urls array." },
      { status: 400 }
    );
  }

  const urls = body.urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "urls must be a non-empty array." },
      { status: 400 }
    );
  }

  if (urls.length > 30) {
    return NextResponse.json(
      { error: "Maximum 30 URLs per request." },
      { status: 400 }
    );
  }

  // ── Import each URL ───────────────────────────────────────────────────────────
  const results: UrlResult[] = [];

  for (const rawUrl of urls) {
    const url = String(rawUrl).trim();

    // Check capacity before each import
    const existingCount = await prisma.inspiration.count({ where: { brandId } });
    if (existingCount >= MAX_PER_BRAND) {
      results.push({ url, status: "failed", error: "inspiration_limit_reached" });
      continue;
    }

    try {
      // Fetch the image
      const { buffer: imageBuffer, contentType } = await fetchImage(url);

      // Normalise MIME type
      let imageMimeType =
        contentType === "image/jpg" ? "image/jpeg" : contentType;

      // Sniff type via sharp if not directly accepted
      if (!ACCEPTED_TYPES.has(imageMimeType)) {
        const meta = await sharp(imageBuffer).metadata();
        const sniffed =
          meta.format === "jpeg"
            ? "image/jpeg"
            : meta.format === "png"
            ? "image/png"
            : meta.format === "webp"
            ? "image/webp"
            : null;
        if (!sniffed) {
          results.push({ url, status: "failed", error: "unsupported_format" });
          continue;
        }
        imageMimeType = sniffed;
      }

      // Size check
      if (imageBuffer.byteLength > MAX_FILE_BYTES) {
        results.push({ url, status: "failed", error: "file_too_large" });
        continue;
      }

      // Dimension check
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        results.push({ url, status: "failed", error: "too_small" });
        continue;
      }

      // SHA-256 dedup — silent skip, no error surfaced to user
      const hash = createHash("sha256").update(imageBuffer).digest("hex");
      const duplicate = await prisma.inspiration.findFirst({
        where: { brandId, imageHash: hash },
      });
      if (duplicate) {
        results.push({
          url,
          status: "duplicate",
          inspirationId: duplicate.id,
        });
        continue;
      }

      // Create DB record
      const inspiration = await prisma.inspiration.create({
        data: { brandId, productId: defaultProductId, imageUrl: "", imageHash: hash, analysisJson: {} },
      });

      const extMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      const ext = extMap[imageMimeType] ?? "jpg";

      // Upload full image to R2
      const imageR2Key = inspirationKey(
        session.user.id,
        brandId,
        inspiration.id,
        ext
      );
      const imageUrl = await uploadToR2(imageR2Key, imageBuffer, imageMimeType);

      // Generate thumbnail
      let thumbnailUrl: string | null = null;
      try {
        const thumbBuffer = await sharp(imageBuffer)
          .resize(THUMB_SIZE, THUMB_SIZE, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();
        const thumbKey = inspirationThumbKey(
          session.user.id,
          brandId,
          inspiration.id
        );
        thumbnailUrl = await uploadToR2(thumbKey, thumbBuffer, "image/jpeg");
      } catch {
        // Thumbnail is optional — continue without it
      }

      // Persist final URLs
      const updated = await prisma.inspiration.update({
        where: { id: inspiration.id },
        data: { imageUrl, thumbnailUrl },
      });

      results.push({ url, status: "imported", inspirationId: updated.id });
    } catch (err) {
      results.push({
        url,
        status: "failed",
        error: err instanceof Error ? err.message : "fetch_failed",
      });
    }
  }

  const imported = results.filter((r) => r.status === "imported").length;
  const duplicates = results.filter((r) => r.status === "duplicate").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    results,
    summary: { imported, duplicates, failed },
  });
}
