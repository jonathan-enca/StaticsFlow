// PATCH /api/user/api-keys — save BYOK API keys to the user's profile
// GET /api/user/api-keys — check which keys are set (values never returned)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { anthropicApiKey: true, geminiApiKey: true },
  });

  return NextResponse.json({
    hasAnthropicKey: !!user?.anthropicApiKey,
    hasGeminiKey: !!user?.geminiApiKey,
    // Expose a masked preview so the user knows which key is saved
    anthropicKeyPreview: user?.anthropicApiKey
      ? `${user.anthropicApiKey.slice(0, 10)}…`
      : null,
    geminiKeyPreview: user?.geminiApiKey
      ? `${user.geminiApiKey.slice(0, 8)}…`
      : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let anthropicApiKey: string | undefined;
  let geminiApiKey: string | undefined;
  try {
    const body = await req.json();
    anthropicApiKey = body.anthropicApiKey;
    geminiApiKey = body.geminiApiKey;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  if (anthropicApiKey !== undefined) {
    data.anthropicApiKey = anthropicApiKey.trim() || null;
  }
  if (geminiApiKey !== undefined) {
    data.geminiApiKey = geminiApiKey.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No keys provided" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id as string },
    data,
  });

  return NextResponse.json({ success: true });
}
