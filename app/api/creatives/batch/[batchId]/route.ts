// GET /api/creatives/batch/[batchId]
// Returns batch status + all creative records in the batch.
// Used for polling progress from the UI.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      creatives: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          imageUrl: true,
          status: true,
          score: true,
          format: true,
          angle: true,
          createdAt: true,
        },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({ batch });
}
