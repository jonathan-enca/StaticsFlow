// POST /api/admin/bdd/upload
// Admin-only: accepts multipart form data with one or more image files.
// For each file:
//   1. Uploads the original to R2 under creatives/<uuid>.<ext>
//   2. Creates a Template record with status "pending analysis"
//   3. Fires a non-blocking analysis request (POST /api/admin/bdd/analyze)
// Returns an array of created Template ids.

import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";
import { randomUUID } from "crypto";

// Allowed MIME types for BDD creatives
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  // Admin guard
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const files = formData.getAll("files") as File[];
  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: "No files provided. Send files as 'files' field." },
      { status: 400 }
    );
  }

  const results: { id: string; sourceImageUrl: string; filename: string }[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push({
        filename: file.name,
        error: `Unsupported file type: ${file.type}`,
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push({
        filename: file.name,
        error: `File too large (${Math.round(file.size / 1024 / 1024)}MB > 20MB limit)`,
      });
      continue;
    }

    try {
      // Determine extension from MIME type
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const uuid = randomUUID();
      const key = `creatives/${uuid}.${ext}`;

      // Upload to R2
      const buffer = Buffer.from(await file.arrayBuffer());
      const imageUrl = await uploadToR2(key, buffer, file.type);

      // Create Template record — analysisJson empty until Claude runs
      const template = await prisma.template.create({
        data: {
          // Sensible defaults — Claude will overwrite these during analysis
          category: "other",
          type: "product_hero",
          layout: "other",
          hookType: "benefice_direct",
          palette: [],
          language: "fr",
          sourceImageUrl: imageUrl,
          thumbnailUrl: null,
          analysisJson: {},
          analyzedAt: null,
        },
      });

      results.push({
        id: template.id,
        sourceImageUrl: imageUrl,
        filename: file.name,
      });

      // Fire-and-forget: trigger Claude analysis in background
      // We do NOT await — the UI will poll or the admin can re-trigger
      const baseUrl =
        process.env.NEXTAUTH_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";

      fetch(`${baseUrl}/api/admin/bdd/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward the cookie header so the admin guard passes
          Cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ templateId: template.id }),
      }).catch((err) =>
        console.error(`[bdd/upload] analysis trigger failed for ${template.id}:`, err)
      );
    } catch (err) {
      console.error(`[bdd/upload] failed for ${file.name}:`, err);
      errors.push({ filename: file.name, error: "Upload failed" });
    }
  }

  return NextResponse.json(
    {
      uploaded: results,
      errors,
      total: files.length,
      success: results.length,
      failed: errors.length,
    },
    { status: results.length > 0 ? 201 : 422 }
  );
}
