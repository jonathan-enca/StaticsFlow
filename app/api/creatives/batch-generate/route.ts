// POST /api/creatives/batch-generate
// Creates a batch generation job and runs it async.
// Returns { batchId } immediately; poll GET /api/creatives/batch/[batchId] for progress.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCreative } from "@/lib/image-generator";
import { qaReviewCreative } from "@/lib/qa-reviewer";
import { findMatchingTemplates } from "@/lib/template-matcher";
import type { AdFormat, CreativeAngle, ImageQuality } from "@/types/index";

const VALID_COUNTS = [1, 5, 10, 20] as const;
type BatchCount = (typeof VALID_COUNTS)[number];

const ALL_ANGLES: CreativeAngle[] = [
  "benefit",
  "pain",
  "social_proof",
  "curiosity",
  "fomo",
  "authority",
  "urgency",
];

/** Distribute `count` creatives across angles as evenly as possible. */
function distributeAngles(count: number, angles: CreativeAngle[]): CreativeAngle[] {
  const result: CreativeAngle[] = [];
  for (let i = 0; i < count; i++) {
    result.push(angles[i % angles.length]);
  }
  return result;
}

/** Fire-and-forget: generates all creatives for a batch, updating DB as each completes. */
async function runBatchAsync(
  batchId: string,
  brandId: string,
  userId: string,
  brandDna: Parameters<typeof generateCreative>[0],
  angles: CreativeAngle[],
  formats: AdFormat[],
  anthropicApiKey?: string,
  geminiApiKey?: string,
  imageQuality?: ImageQuality
) {
  const CONCURRENCY = 3;

  try {
    await prisma.batch.update({
      where: { id: batchId },
      data: { status: "RUNNING" },
    });

    // Pre-create all creative records so the UI can show them immediately
    const creativeRecords = await Promise.all(
      angles.map((angle, idx) =>
        prisma.creative.create({
          data: {
            brandId,
            batchId,
            format: formats[idx % formats.length],
            angle,
            status: "GENERATING",
            briefJson: {},
          },
        })
      )
    );

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < creativeRecords.length; i += CONCURRENCY) {
      const chunk = creativeRecords.slice(i, i + CONCURRENCY);

      await Promise.all(
        chunk.map(async (creative) => {
          try {
            const inspirationTemplates = await findMatchingTemplates(
              brandDna,
              creative.angle as CreativeAngle,
              creative.format as AdFormat
            );

            const generated = await generateCreative(
              brandDna,
              creative.format as AdFormat,
              creative.angle as CreativeAngle,
              userId,
              brandId,
              creative.id,
              { anthropicApiKey, geminiApiKey, inspirationTemplates, imageQuality }
            );

            const qaResult = await qaReviewCreative(
              generated,
              brandDna,
              anthropicApiKey,
              geminiApiKey,
              userId,
              brandId,
              creative.id,
              2,
              imageQuality
            );

            await prisma.creative.update({
              where: { id: creative.id },
              data: {
                imageUrl: qaResult.imageUrl,
                briefJson: generated.brief as object,
                status: qaResult.approved ? "APPROVED" : "QA_REVIEW",
                score: qaResult.score,
              },
            });
          } catch (err) {
            console.error(`[batch-generate] creative ${creative.id} failed:`, err);
            await prisma.creative.update({
              where: { id: creative.id },
              data: { status: "REJECTED" },
            });
          }

          // Increment completed count after each creative (success or fail)
          await prisma.batch.update({
            where: { id: batchId },
            data: { completedCount: { increment: 1 } },
          });
        })
      );
    }

    // Mark batch done
    await prisma.batch.update({
      where: { id: batchId },
      data: { status: "DONE" },
    });
  } catch (err) {
    console.error(`[batch-generate] batch ${batchId} failed:`, err);
    await prisma.batch.update({
      where: { id: batchId },
      data: { status: "FAILED" },
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let brandId: string,
    count: BatchCount,
    formats: string[],
    angles: string[],
    language: string,
    imageQuality: ImageQuality;
  try {
    ({
      brandId,
      count = 5,
      formats = ["1080x1080"],
      angles = ["benefit", "pain", "social_proof", "curiosity"],
      language = "fr",
      imageQuality = "flash",
    } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }
  if (!VALID_COUNTS.includes(count as BatchCount)) {
    return NextResponse.json(
      { error: "count must be 1, 5, 10, or 20" },
      { status: 400 }
    );
  }

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicApiKey: true, geminiApiKey: true },
  });

  // Resolve angles: use provided angles (subset of ALL_ANGLES), fallback to all
  const resolvedAngles = (angles as CreativeAngle[]).filter((a) =>
    ALL_ANGLES.includes(a)
  );
  const effectiveAngles =
    resolvedAngles.length > 0 ? resolvedAngles : ALL_ANGLES;

  const distributedAngles = distributeAngles(count, effectiveAngles);
  const effectiveFormats = (formats as AdFormat[]).filter((f) =>
    ["1080x1080", "1080x1350", "1200x628"].includes(f)
  );
  const resolvedFormats: AdFormat[] = effectiveFormats.length > 0 ? effectiveFormats : ["1080x1080"];

  // Create the batch record
  const batch = await prisma.batch.create({
    data: {
      brandId,
      userId: session.user.id,
      totalCount: count,
      completedCount: 0,
      status: "PENDING",
    },
  });

  // Kick off async generation (fire-and-forget — Node.js keeps the event loop alive)
  const brandDna = brand.brandDnaJson as unknown as Parameters<typeof generateCreative>[0];
  const userId = session.user.id as string;
  setImmediate(() => {
    runBatchAsync(
      batch.id,
      brandId,
      userId,
      brandDna,
      distributedAngles,
      resolvedFormats,
      user?.anthropicApiKey ?? undefined,
      user?.geminiApiKey ?? undefined,
      imageQuality
    ).catch((err) => console.error("[batch-generate] runBatchAsync threw:", err));
  });

  return NextResponse.json({ batchId: batch.id }, { status: 202 });
}
