// PATCH /api/admin/users/[userId] — update user fields (plan, isAdmin)
// DELETE /api/admin/users/[userId] — delete user + all their data (cascade)
// Protected by adminGuard()

import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { userId } = await params;
  const body = await req.json();
  const { plan, isAdmin } = body;

  // Build update payload — only allow safe fields
  const data: { plan?: "STARTER" | "PRO" | "AGENCY"; isAdmin?: boolean } = {};
  if (plan !== undefined) {
    if (!["STARTER", "PRO", "AGENCY"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    data.plan = plan as "STARTER" | "PRO" | "AGENCY";
  }
  if (isAdmin !== undefined) {
    if (typeof isAdmin !== "boolean") {
      return NextResponse.json({ error: "isAdmin must be boolean" }, { status: 400 });
    }
    // Prevent self-demotion (safety guard)
    const session = await auth();
    if (session?.user?.id === userId && isAdmin === false) {
      return NextResponse.json(
        { error: "Cannot revoke your own admin rights" },
        { status: 400 }
      );
    }
    data.isAdmin = isAdmin;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      isAdmin: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const forbidden = await adminGuard();
  if (forbidden) return forbidden;

  const { userId } = await params;

  // Prevent self-deletion
  const session = await auth();
  if (session?.user?.id === userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
