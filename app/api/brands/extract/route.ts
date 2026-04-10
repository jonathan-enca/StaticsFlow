// POST /api/brands/extract
// Extracts Brand DNA from a URL and saves it to the database
// Auth required: user must be signed in
// BYOK: uses user's anthropicApiKey if set, falls back to env var in dev

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractBrandDNA } from "@/lib/brand-dna-extractor";

export async function POST(req: NextRequest) {
  // Require authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let url: string;
  try {
    ({ url } = await req.json());
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

  // Get user's API key (BYOK) or fall back to dev env key
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicApiKey: true },
  });
  const anthropicApiKey = user?.anthropicApiKey ?? undefined;

  try {
    const dna = await extractBrandDNA(normalizedUrl, anthropicApiKey);

    // Upsert brand: update if same user+url already exists
    const brand = await prisma.brand.upsert({
      where: { userId_url: { userId: session.user.id, url: normalizedUrl } },
      update: { name: dna.name, brandDnaJson: dna as object },
      create: {
        userId: session.user.id,
        name: dna.name,
        url: normalizedUrl,
        brandDnaJson: dna as object,
      },
    });

    return NextResponse.json({ brand, dna }, { status: 201 });
  } catch (err) {
    console.error("[brands/extract]", err);
    return NextResponse.json(
      { error: "Failed to extract Brand DNA. Check that the URL is accessible and your Claude API key is valid." },
      { status: 500 }
    );
  }
}
