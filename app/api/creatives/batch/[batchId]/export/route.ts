// GET /api/creatives/batch/[batchId]/export
// Returns a ZIP archive of all approved/generated images in the batch.
// Naming: {brandName}_{angle}_{format}_{date}.png
// Only available when batch status is DONE.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batchId } = await params;

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, userId: session.user.id },
    include: {
      brand: { select: { name: true } },
      creatives: {
        where: { status: { in: ["APPROVED", "QA_REVIEW"] }, imageUrl: { not: null } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  if (batch.status !== "DONE") {
    return NextResponse.json(
      { error: "Batch is not yet complete" },
      { status: 409 }
    );
  }

  const zip = new JSZip();
  const dateStr = new Date(batch.createdAt).toISOString().slice(0, 10);
  const brandSlug = batch.brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  // Fetch each image and add to ZIP
  const fetchPromises = batch.creatives.map(async (creative, idx) => {
    const url = creative.imageUrl!;
    let imageBuffer: Buffer;

    if (url.startsWith("data:image/png;base64,")) {
      // Dev data URL fallback
      const base64 = url.replace("data:image/png;base64,", "");
      imageBuffer = Buffer.from(base64, "base64");
    } else {
      const res = await fetch(url);
      if (!res.ok) return; // skip images that fail to fetch
      const arrayBuffer = await res.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    const filename = `${brandSlug}_${creative.angle}_${creative.format}_${dateStr}_${String(idx + 1).padStart(2, "0")}.png`;
    zip.file(filename, imageBuffer);
  });

  await Promise.all(fetchPromises);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${brandSlug}_batch_${dateStr}.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
