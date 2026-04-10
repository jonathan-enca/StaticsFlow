// POST /api/brands/extract
// Extracts Brand DNA from a URL.
// Auth optional: if signed in, saves the brand to DB and returns brand.id.
// If not signed in (onboarding guest flow), returns DNA only (no DB write).
// BYOK: uses user's saved anthropicApiKey if set, falls back to ANTHROPIC_API_KEY env var.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractBrandDNA } from "@/lib/brand-dna-extractor";

export async function POST(req: NextRequest) {
  let url: string;
  let inlineAnthropicKey: string | undefined;
  try {
    const body = await req.json();
    url = body.url;
    inlineAnthropicKey = body.anthropicApiKey || undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Normalize URL
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  try {
    new URL(normalizedUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Check auth (optional — guests can extract without saving)
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Key priority: inline (onboarding guest) > DB (authenticated user) > env var
  let anthropicApiKey: string | undefined = inlineAnthropicKey;
  if (!anthropicApiKey && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { anthropicApiKey: true },
    });
    anthropicApiKey = user?.anthropicApiKey ?? undefined;
  }

  try {
    const dna = await extractBrandDNA(normalizedUrl, anthropicApiKey);

    // Authenticated: persist brand to DB
    if (userId) {
      const brand = await prisma.brand.upsert({
        where: { userId_url: { userId, url: normalizedUrl } },
        update: { name: dna.name, brandDnaJson: dna as object },
        create: {
          userId,
          name: dna.name,
          url: normalizedUrl,
          brandDnaJson: dna as object,
        },
      });
      return NextResponse.json({ brand, dna }, { status: 201 });
    }

    // Guest (onboarding): return DNA without DB write
    // The brand will be saved when the user signs up
    return NextResponse.json(
      { brand: { id: null, name: dna.name, url: normalizedUrl }, dna },
      { status: 200 }
    );
  } catch (err) {
    console.error("[brands/extract]", err);
    return NextResponse.json(
      {
        error:
          "Failed to extract Brand DNA. Check that the URL is accessible and your Claude API key is valid.",
      },
      { status: 500 }
    );
  }
}
