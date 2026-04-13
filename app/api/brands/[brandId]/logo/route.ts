// POST /api/brands/[brandId]/logo
// Uploads a brand logo to R2 and stores the URL in brandDnaJson.logoUrl.
// Auth required — user must own the brand.
// Body: multipart/form-data — field "file" (image)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, brandLogoKey } from "@/lib/r2";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import { randomUUID } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type. Allowed: ${ALLOWED_MIME.join(", ")}` },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const ext = extFromMime(file.type);
  const key = brandLogoKey(session.user.id, brandId, ext);
  const logoUrl = await uploadToR2(key, Buffer.from(bytes), file.type);

  // Update brandDnaJson.logoUrl
  const dna = (brand.brandDnaJson ?? {}) as unknown as ExtractedBrandDNA;
  await prisma.brand.update({
    where: { id: brandId },
    data: { brandDnaJson: { ...dna, logoUrl } as object },
  });

  return NextResponse.json({ logoUrl }, { status: 200 });
}
