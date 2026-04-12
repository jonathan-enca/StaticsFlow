/**
 * analyze-bdd-direct.ts
 *
 * Batch-analyzes unanalyzed Template records in the production DB.
 * Bypasses the HTTP layer — reads stored API key from DB, calls Claude directly.
 *
 * Usage:
 *   npx tsx scripts/analyze-bdd-direct.ts
 *   npx tsx scripts/analyze-bdd-direct.ts --limit 50 --concurrency 3
 *
 * Env vars (loaded from .env.local):
 *   DATABASE_URL          — Supabase connection string
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME
 */

import path from "path";
import { parseArgs } from "util";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

loadEnvConfig(path.resolve(__dirname, ".."));

// ─────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    limit:       { type: "string", default: "0" },   // 0 = all
    concurrency: { type: "string", default: "2" },
    force:       { type: "boolean", default: false }, // re-analyze already-analyzed templates
  },
  strict: true,
});

const limitN      = parseInt(values["limit"] as string, 10);
const concurrency = Math.max(1, parseInt(values["concurrency"] as string, 10));
const force       = values["force"] as boolean;

// ─────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as never);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? "staticsflow-creatives";

async function getPresignedUrl(publicUrl: string): Promise<string> {
  try {
    const urlObj = new URL(publicUrl);
    const key    = urlObj.pathname.replace(/^\//, "");
    const cmd    = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(r2, cmd, { expiresIn: 3600 });
  } catch {
    return publicUrl; // fallback: use public URL directly
  }
}

// ─────────────────────────────────────────────────────────────
// Claude analysis
// ─────────────────────────────────────────────────────────────

const ANALYSIS_SCHEMA = `{
  "category": "skincare | food | fashion | tech | fitness | home | beauty | health | pet | other",
  "type": "product_hero | before_after | comparatif | testimonial | promo | ugc_screenshot | lifestyle | data_stats | listicle | press_mention",
  "layout": "grid | split | centered | overlay | other",
  "hookType": "pain | curiosite | social_proof | fomo | benefice_direct | autorite | urgence",
  "palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB"],
  "language": "fr | en | de | other"
}`;

const SYSTEM_PROMPT = `You are an expert ad creative analyst specialising in Meta (Facebook/Instagram) static ad creatives.
Your job: analyse the provided ad image and return a precise JSON classification.

Return ONLY valid JSON matching this schema — no markdown fences, no extra text:
${ANALYSIS_SCHEMA}

Field definitions:
- category: the product category advertised
- type: the creative format/type
- layout: the visual composition structure
- hookType: the primary psychological hook used in the copy/visual
- palette: top 3 dominant hex colors in the creative (background, primary element, accent)
- language: the language of the copy in the creative

Be precise. If unsure, choose the closest match from the allowed values.`;

const VALID_CATEGORIES = ["skincare","food","fashion","tech","fitness","home","beauty","health","pet","other"];
const VALID_TYPES = ["product_hero","before_after","comparatif","testimonial","promo","ugc_screenshot","lifestyle","data_stats","listicle","press_mention"];
const VALID_LAYOUTS = ["grid","split","centered","overlay","other"];
const VALID_HOOKS = ["pain","curiosite","social_proof","fomo","benefice_direct","autorite","urgence"];
const VALID_LANGUAGES = ["fr","en","de","other"];

interface Analysis {
  category: string;
  type: string;
  layout: string;
  hookType: string;
  palette: string[];
  language: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeTemplate(
  claude: Anthropic,
  templateId: string,
  imageUrl: string
): Promise<void> {
  const presigned = await getPresignedUrl(imageUrl);

  // Retry with exponential backoff on 429 rate-limit errors
  let message;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      message = await claude.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: presigned },
            },
            {
              type: "text",
              text: "Analyse this ad creative and return the JSON classification.",
            },
          ],
        }],
      });
      break; // success
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < 5) {
        const waitMs = Math.min(4000 * Math.pow(2, attempt), 60000); // 4s, 8s, 16s, 32s, 60s
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  if (!message) throw new Error("Failed after retries");

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = rawText.replace(/```(?:json)?\n?/g, "").trim();
  const analysis: Analysis = JSON.parse(cleaned);

  const safe = {
    category: VALID_CATEGORIES.includes(analysis.category) ? analysis.category : "other",
    type:     VALID_TYPES.includes(analysis.type) ? analysis.type : "product_hero",
    layout:   VALID_LAYOUTS.includes(analysis.layout) ? analysis.layout : "other",
    hookType: VALID_HOOKS.includes(analysis.hookType) ? analysis.hookType : "benefice_direct",
    palette:  Array.isArray(analysis.palette)
      ? analysis.palette.slice(0, 4).filter((c: string) => /^#[0-9a-fA-F]{6}$/.test(c))
      : [],
    language: VALID_LANGUAGES.includes(analysis.language) ? analysis.language : "other",
  };

  await (prisma as PrismaClient).template.update({
    where: { id: templateId },
    data: { ...safe, analysisJson: analysis as object, analyzedAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────
// Concurrency pool
// ─────────────────────────────────────────────────────────────

async function runConcurrent<T>(
  items: T[],
  fn: (item: T, idx: number) => Promise<void>,
  maxConcurrent: number
): Promise<void> {
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(maxConcurrent, items.length) }, () => worker()));
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Get stored API key from first admin user
  const user = await (prisma as PrismaClient).user.findFirst({
    where: { isAdmin: true },
    select: { anthropicApiKey: true, email: true },
  });

  if (!user?.anthropicApiKey) {
    console.error("No anthropicApiKey found in DB. Please set it in Settings.");
    process.exit(1);
  }
  console.log(`Using API key from: ${user.email}`);

  const claude = new Anthropic({ apiKey: user.anthropicApiKey });

  // Fetch templates to analyze
  const whereClause = force ? {} : { analyzedAt: null };
  const total = await (prisma as PrismaClient).template.count({ where: whereClause });
  const templates = await (prisma as PrismaClient).template.findMany({
    where: whereClause,
    select: { id: true, sourceImageUrl: true },
    orderBy: { uploadedAt: "asc" },
    ...(limitN > 0 ? { take: limitN } : {}),
  });

  const label = force ? "templates (force re-analyze)" : "unanalyzed templates";
  console.log(`Found ${total} ${label}. Processing ${templates.length} (concurrency=${concurrency})…\n`);

  let done   = 0;
  let errors = 0;

  await runConcurrent(templates, async (t, idx) => {
    try {
      await analyzeTemplate(claude, t.id, t.sourceImageUrl);
      done++;
      const pct = Math.round(((idx + 1) / templates.length) * 100);
      process.stdout.write(`\r[${pct}%] ${done} analyzed, ${errors} errors`);
    } catch (err) {
      errors++;
      console.error(`\n  ✗ ${t.id}: ${(err as Error).message}`);
    }
  }, concurrency);

  console.log(`\n\nDone: ${done} analyzed, ${errors} errors.`);

  // Verify
  const remaining = await (prisma as PrismaClient).template.count({ where: { analyzedAt: null } });
  console.log(`Unanalyzed remaining: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
