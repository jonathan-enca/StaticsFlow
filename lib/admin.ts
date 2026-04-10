// Admin guard helpers
// Routes under /admin and /api/admin are restricted to users with isAdmin=true

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

/**
 * Server component guard: redirect non-admin users to /dashboard.
 * Call at the top of any admin Server Component (layout or page).
 */
export async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) redirect("/dashboard");
  return session.user.id;
}

/**
 * API route guard: return a 403 NextResponse if the caller is not an admin.
 * Returns null when the caller is an authorised admin (proceed normally).
 *
 * Usage:
 *   const forbidden = await adminGuard();
 *   if (forbidden) return forbidden;
 */
export async function adminGuard(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
