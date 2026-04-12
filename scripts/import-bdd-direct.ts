/**
 * import-bdd-direct.ts
 *
 * Direct database import for BDD templates — bypasses HTTP auth layer.
 * Uploads images straight to R2 and inserts Template rows into the production DB.
 * Optionally triggers Claude analysis via the HTTP API afterwards.
 *
 * Usage:
 *   npx tsx scripts/import-bdd-direct.ts --folder "/path/to/images" --limit 100
 *   npx tsx scripts/import-bdd-direct.ts --folder "/path/to/images" --limit 100 --no-analyze
 *
 * Env vars required (loaded from .env.local automatically):
 *   DATABASE_URL          — Supabase connection string
 *   R2_ACCOUNT_ID         — Cloudflare R2 account ID
 *   R2_ACCESS_KEY_ID      — R2 access key
 *   R2_SECRET_ACCESS_KEY  — R2 secret
 *   R2_BUCKET_NAME        — R2 bucket name
 *   R2_PUBLIC_URL         — R2 public base URL
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { randomUUID } from "crypto";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Load .env.local (must be called before anything reads process.env)
loadEnvConfig(path.resolve(__dirname, ".."));

// ─────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    folder:       { type: "string" },
    limit:        { type: "string", default: "100" },
    "no-analyze": { type: "boolean", default: false },
    "api-url":    { type: "string", default: "http://localhost:3001" },
    token:        { type: "string" },
    concurrency:  { type: "string", default: "5" },
  },
  strict: true,
});

const folderArg   = values["folder"];
const limitN      = Math.max(1, parseInt(values["limit"] as string, 10));
const noAnalyze   = Boolean(values["no-analyze"]);
const apiUrl      = (values["api-url"] as string).replace(/\/$/, "");
const sessionToken = values["token"] ?? process.env.ADMIN_SESSION_TOKEN;
const concurrency = Math.max(1, parseInt(values["concurrency"] as string, 10));

if (!folderArg) {
  console.error("Error: --folder <path> is required");
  process.exit(1);
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIME: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
};

// ─────────────────────────────────────────────────────────────
// R2 client
// ─────────────────────────────────────────────────────────────

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET      = process.env.R2_BUCKET_NAME ?? "staticsflow-creatives";
const R2_BASE_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }));
  return `${R2_BASE_URL}/${key}`;
}

// ─────────────────────────────────────────────────────────────
// Prisma client
// ─────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as never);

// ─────────────────────────────────────────────────────────────
// Concurrency helper
// ─────────────────────────────────────────────────────────────

async function runConcurrent<T>(
  items: T[],
  fn: (item: T, idx: number) => Promise<void>,
  maxConcurrent: number
): Promise<void> {
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i    = idx++;
      const item = items[i];
      await fn(item, i);
    }
  }

  const pool = Array.from({ length: Math.min(maxConcurrent, items.length) }, () => worker());
  await Promise.all(pool);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Gather image files
  const allFiles = fs
    .readdirSync(folderArg!)
    .filter(f => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map(f => path.join(folderArg!, f));

  console.log(`Found ${allFiles.length} images in folder. Will import up to ${limitN}.`);
  const files = allFiles.slice(0, limitN);
  console.log(`Processing ${files.length} files (concurrency=${concurrency})…\n`);

  let uploaded = 0;
  let failed   = 0;
  const templateIds: string[] = [];

  await runConcurrent(files, async (filePath, idx) => {
    const filename = path.basename(filePath);
    const ext      = path.extname(filename).toLowerCase();
    const mimeType = MIME[ext] ?? "image/jpeg";

    try {
      const buffer   = fs.readFileSync(filePath);
      const uuid     = randomUUID();
      const key      = `creatives/${uuid}${ext}`;
      const imageUrl = await uploadToR2(key, buffer, mimeType);

      const template = await (prisma as PrismaClient).template.create({
        data: {
          category:      "other",
          type:          "product_hero",
          layout:        "other",
          hookType:      "benefice_direct",
          palette:       [],
          language:      "fr",
          sourceImageUrl: imageUrl,
          thumbnailUrl:   null,
          analysisJson:   {},
          analyzedAt:     null,
        },
      });

      templateIds.push(template.id);
      uploaded++;

      const pct = Math.round(((idx + 1) / files.length) * 100);
      process.stdout.write(`\r[${pct}%] ${uploaded} uploaded, ${failed} failed — ${filename.slice(0, 40)}`);
    } catch (err) {
      failed++;
      console.error(`\n  ✗ ${filename}: ${(err as Error).message}`);
    }
  }, concurrency);

  console.log(`\n\nImport complete: ${uploaded} uploaded, ${failed} failed.`);
  console.log(`Template rows in DB: ${templateIds.length}`);

  // ── Optional: trigger analysis on all uploaded templates ──────────────
  if (!noAnalyze && templateIds.length > 0) {
    if (!sessionToken) {
      console.warn("\n⚠ Skipping analysis: no ADMIN_SESSION_TOKEN or --token provided.");
      console.warn("  Trigger analysis from /admin/bdd after starting the app.");
    } else {
      console.log(`\nTriggering Claude analysis for ${templateIds.length} templates…`);
      let analyzed      = 0;
      let analyzeErrors = 0;

      await runConcurrent(templateIds, async (templateId) => {
        try {
          const res = await fetch(`${apiUrl}/api/admin/bdd/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cookie": `authjs.session-token=${sessionToken}`,
            },
            body: JSON.stringify({ templateId }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status}: ${body}`);
          }

          analyzed++;
          process.stdout.write(`\r  Analysis: ${analyzed}/${templateIds.length} done`);
        } catch (err) {
          analyzeErrors++;
          console.error(`\n  ✗ analysis for ${templateId}: ${(err as Error).message}`);
        }
      }, 2); // lower concurrency for AI calls to avoid rate limits

      console.log(`\n  Analysis complete: ${analyzed} done, ${analyzeErrors} errors.`);
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
