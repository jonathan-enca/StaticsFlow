// Brand DNA page — /brand-dna
// Entry point for the brand profile flow (SPECS.md §6.1).
// Redirects to the user's most-recently-updated brand DNA editor,
// or to /onboarding if they have no brands yet.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Brand DNA — StaticsFlow",
  description: "Manage your brand profile: colors, tone, personas, and more.",
};

export default async function BrandDnaPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session?.user?.id) redirect("/login");

  // Find the most recently updated brand for this user
  const brand = await prisma.brand.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (brand) {
    redirect(`/dashboard/brands/${brand.id}`);
  }

  // No brands yet — send to onboarding to create the first one
  redirect("/onboarding");
}
