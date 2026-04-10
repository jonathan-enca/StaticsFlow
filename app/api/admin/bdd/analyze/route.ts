// POST /api/admin/bdd/analyze
// Admin-only: runs Claude vision analysis on a Template record.
// Called automatically after upload (fire-and-forget) or manually to re-analyze.
// Body: { templateId: string }
//
// Claude returns structured JSON with:
//   category, type, layout, hookType, palette (top 3 hex), language
// These fields are written back to the Template row alongside analyzedAt.

import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { createClaudeClient, CLAUDE_MODEL } from "@/lib/claude";
import { getPresignedUrl } from "@/lib/r2";
import { auth } from "@/lib/auth";

// ──────────────────────────────────────────────────────────────
// JSON schema that Claude must return
// ──────────────────────────────────────────────────────────────
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

export async function POST(req: NextRequest) {
  // Admin guard
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  let templateId: string;
  try {
    const body = await req.json();
    templateId = body.templateId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!templateId || typeof templateId !== "string") {
    return NextResponse.json(
      { error: "templateId is required" },
      { status: 400 }
    );
  }

  // Fetch template
  const template = await prisma.template.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Get user's API key (admin's key) or fall back to env var
  const session = await auth();
  let anthropicApiKey: string | undefined;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { anthropicApiKey: true },
    });
    anthropicApiKey = user?.anthropicApiKey ?? undefined;
  }

  // Build a presigned URL so Claude can fetch the image from R2
  // (R2 public URLs may be restricted; presigned URLs are always accessible)
  let imageUrl: string;
  try {
    // Extract key from R2 URL (format: <base>/<key>)
    const urlObj = new URL(template.sourceImageUrl);
    const key = urlObj.pathname.replace(/^\//, "");
    imageUrl = await getPresignedUrl(key);
  } catch {
    // Fallback: use sourceImageUrl directly (works if bucket is public)
    imageUrl = template.sourceImageUrl;
  }

  try {
    const claude = createClaudeClient(anthropicApiKey);

    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: "Analyse this ad creative and return the JSON classification.",
            },
          ],
        },
      ],
    });

    // Extract text content from response
    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON — Claude is instructed to return raw JSON only
    let analysis: {
      category: string;
      type: string;
      layout: string;
      hookType: string;
      palette: string[];
      language: string;
    };
    try {
      // Strip any accidental markdown fences
      const cleaned = rawText.replace(/```(?:json)?\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error(`[bdd/analyze] JSON parse failed for ${templateId}:`, rawText);
      return NextResponse.json(
        { error: "Claude returned invalid JSON", raw: rawText },
        { status: 502 }
      );
    }

    // Validate and sanitize values (fall back to defaults if Claude hallucinated)
    const VALID_CATEGORIES = [
      "skincare","food","fashion","tech","fitness","home","beauty","health","pet","other",
    ];
    const VALID_TYPES = [
      "product_hero","before_after","comparatif","testimonial","promo",
      "ugc_screenshot","lifestyle","data_stats","listicle","press_mention",
    ];
    const VALID_LAYOUTS = ["grid","split","centered","overlay","other"];
    const VALID_HOOKS = [
      "pain","curiosite","social_proof","fomo","benefice_direct","autorite","urgence",
    ];
    const VALID_LANGUAGES = ["fr","en","de","other"];

    const safe = {
      category: VALID_CATEGORIES.includes(analysis.category)
        ? analysis.category
        : "other",
      type: VALID_TYPES.includes(analysis.type) ? analysis.type : "product_hero",
      layout: VALID_LAYOUTS.includes(analysis.layout) ? analysis.layout : "other",
      hookType: VALID_HOOKS.includes(analysis.hookType)
        ? analysis.hookType
        : "benefice_direct",
      palette: Array.isArray(analysis.palette)
        ? analysis.palette.slice(0, 3).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
        : [],
      language: VALID_LANGUAGES.includes(analysis.language)
        ? analysis.language
        : "other",
    };

    // Persist back to DB
    const updated = await prisma.template.update({
      where: { id: templateId },
      data: {
        ...safe,
        analysisJson: analysis as object,
        analyzedAt: new Date(),
      },
    });

    return NextResponse.json({ template: updated }, { status: 200 });
  } catch (err) {
    console.error(`[bdd/analyze] Claude call failed for ${templateId}:`, err);
    return NextResponse.json(
      { error: "Analysis failed. Check your Claude API key." },
      { status: 500 }
    );
  }
}
