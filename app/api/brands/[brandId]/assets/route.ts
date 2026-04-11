// POST /api/brands/[brandId]/assets
// Uploads a custom brand asset (packshot, studio photo, UGC) to R2.
// Appends the asset reference to brandDnaJson.customAssets.
// Auth required — user must own the brand.
// Body: multipart/form-data — field "file" (image), field "type" (packshot|studio|ugc|other)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, brandAssetKey } from "@/lib/r2";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { CustomAsset } from "@/types/index";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["packshot", "studio", "ugc", "other"] as const;
type AssetType = (typeof ALLOWED_TYPES)[number];

// 10 MB max upload size
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  // Verify ownership
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const assetType = (formData.get("type") as string | null) ?? "other";

  if (!file) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(assetType as AssetType)) {
    return NextResponse.json(
      { error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large — max 10 MB" },
      { status: 413 }
    );
  }

  // Derive extension from MIME type
  const mime = file.type;
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extMap[mime] ?? "bin";
  if (!extMap[mime]) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PNG, JPEG, or WebP." },
      { status: 415 }
    );
  }

  const assetId = randomUUID();
  const key = brandAssetKey(session.user.id, brandId, assetId, ext);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    let assetUrl: string;
    if (
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCOUNT_ID !== "YOUR_CLOUDFLARE_ACCOUNT_ID"
    ) {
      assetUrl = await uploadToR2(key, buffer, mime);
    } else {
      // Dev fallback: use a data URL placeholder (not persisted)
      assetUrl = `data:${mime};base64,${buffer.toString("base64").slice(0, 30)}...`;
      console.warn("[brands/assets] R2 not configured — asset not persisted");
    }

    // Append to customAssets in brandDnaJson
    const existingDna = (brand.brandDnaJson ?? {}) as Partial<ExtractedBrandDNA>;
    const existingAssets: CustomAsset[] = existingDna.customAssets ?? [];
    const newAsset: CustomAsset = {
      id: assetId,
      type: assetType as AssetType,
      url: assetUrl,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
    };

    const merged = {
      ...existingDna,
      customAssets: [...existingAssets, newAsset],
    };

    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: { brandDnaJson: merged as object },
    });

    return NextResponse.json({ brand: updated, asset: newAsset }, { status: 201 });
  } catch (err) {
    console.error("[brands/assets]", err);
    return NextResponse.json(
      { error: "Failed to upload asset. Please try again." },
      { status: 500 }
    );
  }
}
