// POST /api/brands/[brandId]/inspirations/import-url
// Server-side fetch of a user-supplied URL to extract an image and save it as an inspiration.
//
// Behavior:
//   - If the URL ends in a known image extension → fetch directly
//   - Otherwise, fetch the HTML page and extract <meta property="og:image"> or first <img src>
//   - Download the resolved image, validate type/size/dimensions
//   - Upload to R2 + create Inspiration record (same path as direct upload)
//
// V1 constraints:
//   - Single HTTP GET per request — no headless browser, no proxy
//   - Max 1 image per call
//   - If Meta (or any CDN) blocks the fetch → return friendly 422

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, inspirationKey, inspirationThumbKey } from "@/lib/r2";

export const maxDuration = 30;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PER_BRAND = 50;
const MIN_DIMENSION = 400;
const THUMB_SIZE = 400;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)(\?.*)?$/i;

// Mime types we'll attempt to accept from direct image fetches
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Resolve a possibly-relative src to an absolute URL, given the page URL. */
function resolveUrl(src: string, pageUrl: string): string | null {
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return null;
  }
}

/**
 * Extract a candidate image URL from an HTML string.
 * Priority: og:image → first <img src> tag.
 */
function extractImageUrl(html: string, pageUrl: string): string | null {
  // og:image meta tag
  const ogMatch = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  );
  if (ogMatch?.[1]) {
    const resolved = resolveUrl(ogMatch[1], pageUrl);
    if (resolved) return resolved;
  }

  // First <img src>
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    return resolveUrl(imgMatch[1], pageUrl);
  }

  return null;
}

/**
 * Fetch a URL and return its buffer + content-type.
 * Throws a descriptive error string on failure.
 */
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
      // No redirect limit override needed — fetch follows redirects by default
    });
  } catch {
    throw new Error(
      "Could not reach that URL. Check it's publicly accessible."
    );
  }

  if (!response.ok) {
    throw new Error(
      `The server returned ${response.status}. The URL may be private or blocked.`
    );
  }

  const rawType = response.headers.get("content-type") ?? "";
  const contentType = rawType.split(";")[0].trim().toLowerCase();
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
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

  // ── Capacity check ────────────────────────────────────────────────────────────
  const existingCount = await prisma.inspiration.count({ where: { brandId } });
  if (existingCount >= MAX_PER_BRAND) {
    return NextResponse.json(
      {
        error: "inspiration_limit_reached",
        message: `Maximum ${MAX_PER_BRAND} inspirations per brand.`,
      },
      { status: 422 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with a url field." },
      { status: 400 }
    );
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return NextResponse.json(
      { error: "url field is required." },
      { status: 400 }
    );
  }

  // Basic URL validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Protocol not allowed");
  } catch {
    return NextResponse.json(
      { error: "invalid_url", message: "Please enter a valid http(s) URL." },
      { status: 422 }
    );
  }

  // ── Fetch: direct image or HTML page ─────────────────────────────────────────
  let imageBuffer: Buffer;
  let imageMimeType: string;

  const isDirectImage = IMAGE_EXT_RE.test(parsedUrl.pathname);

  try {
    if (isDirectImage) {
      // Direct image URL
      const { buffer, contentType } = await fetchImage(rawUrl);
      if (!ACCEPTED_TYPES.has(contentType) && !MIME_TO_EXT[contentType]) {
        // Fallback: try sniffing via sharp
        const sharpMeta = await sharp(buffer).metadata();
        const sniffed =
          sharpMeta.format === "jpeg"
            ? "image/jpeg"
            : sharpMeta.format === "png"
            ? "image/png"
            : sharpMeta.format === "webp"
            ? "image/webp"
            : null;
        if (!sniffed) {
          return NextResponse.json(
            {
              error: "unsupported_format",
              message:
                "Only JPEG, PNG, and WebP images are supported. Could not fetch that URL automatically. Try saving the image and uploading it directly.",
            },
            { status: 422 }
          );
        }
        imageMimeType = sniffed;
      } else {
        imageMimeType = ACCEPTED_TYPES.has(contentType)
          ? contentType
          : contentType; // normalise below
      }
      imageBuffer = buffer;
    } else {
      // HTML page — fetch and extract image URL
      const { buffer: htmlBuffer, contentType } = await fetchImage(rawUrl);

      if (contentType.startsWith("image/")) {
        // The URL returned an image directly despite no extension
        imageBuffer = htmlBuffer;
        imageMimeType = contentType;
      } else {
        // Parse HTML to find image
        const html = htmlBuffer.toString("utf8");
        const candidateUrl = extractImageUrl(html, rawUrl);

        if (!candidateUrl) {
          return NextResponse.json(
            {
              error: "no_image_found",
              message:
                "Could not find an image at that URL. Try saving the image and uploading it directly.",
            },
            { status: 422 }
          );
        }

        const { buffer, contentType: imgType } = await fetchImage(candidateUrl);
        imageBuffer = buffer;
        imageMimeType = imgType;
      }
    }
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Could not fetch that URL automatically. Try saving the image and uploading it directly.";
    return NextResponse.json(
      { error: "fetch_failed", message: msg },
      { status: 422 }
    );
  }

  // ── Normalise mime type ───────────────────────────────────────────────────────
  // Some servers return "image/jpg" — normalise to "image/jpeg"
  if (imageMimeType === "image/jpg") imageMimeType = "image/jpeg";

  if (!ACCEPTED_TYPES.has(imageMimeType)) {
    // Try sniffing with sharp as last resort
    try {
      const meta = await sharp(imageBuffer).metadata();
      const sniffed =
        meta.format === "jpeg"
          ? "image/jpeg"
          : meta.format === "png"
          ? "image/png"
          : meta.format === "webp"
          ? "image/webp"
          : null;
      if (sniffed) {
        imageMimeType = sniffed;
      } else {
        return NextResponse.json(
          {
            error: "unsupported_format",
            message:
              "Only JPEG, PNG, and WebP images are supported. Could not fetch that URL automatically. Try saving the image and uploading it directly.",
          },
          { status: 422 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: "invalid_image",
          message: "Could not read the image. Try saving it and uploading it directly.",
        },
        { status: 422 }
      );
    }
  }

  // ── Size check ────────────────────────────────────────────────────────────────
  if (imageBuffer.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "The fetched image exceeds the 10 MB limit." },
      { status: 422 }
    );
  }

  // ── Dimension check ───────────────────────────────────────────────────────────
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch {
    return NextResponse.json(
      { error: "invalid_image", message: "Could not read image metadata. Try uploading directly." },
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

  // ── Deduplication ─────────────────────────────────────────────────────────────
  const hash = createHash("sha256").update(imageBuffer).digest("hex");
  const duplicate = await prisma.inspiration.findFirst({
    where: { brandId, imageHash: hash },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error: "duplicate",
        message: "This image is already in your library.",
        inspirationId: duplicate.id,
      },
      { status: 409 }
    );
  }

  // ── Create DB record ──────────────────────────────────────────────────────────
  const inspiration = await prisma.inspiration.create({
    data: {
      brandId,
      imageUrl: "",
      imageHash: hash,
      analysisJson: {},
    },
  });

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extMap[imageMimeType] ?? "jpg";

  // ── Upload to R2 ──────────────────────────────────────────────────────────────
  const imageR2Key = inspirationKey(session.user.id, brandId, inspiration.id, ext);
  let imageUrl: string;
  try {
    imageUrl = await uploadToR2(imageR2Key, imageBuffer, imageMimeType);
  } catch (err) {
    console.error("[import-url] R2 upload failed:", err);
    await prisma.inspiration.delete({ where: { id: inspiration.id } });
    return NextResponse.json(
      { error: "upload_failed", message: "Could not store the image. Try again." },
      { status: 500 }
    );
  }

  // ── Thumbnail ─────────────────────────────────────────────────────────────────
  let thumbnailUrl: string | null = null;
  try {
    const thumbBuffer = await sharp(imageBuffer)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbKey = inspirationThumbKey(session.user.id, brandId, inspiration.id);
    thumbnailUrl = await uploadToR2(thumbKey, thumbBuffer, "image/jpeg");
  } catch (err) {
    console.warn("[import-url] Thumbnail generation failed:", err);
  }

  // ── Persist URLs ──────────────────────────────────────────────────────────────
  const updated = await prisma.inspiration.update({
    where: { id: inspiration.id },
    data: { imageUrl, thumbnailUrl },
  });

  return NextResponse.json({ inspiration: updated }, { status: 201 });
}
