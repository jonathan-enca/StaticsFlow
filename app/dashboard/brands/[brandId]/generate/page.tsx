// Creative generation page — server component wrapper
// Route: /dashboard/brands/[brandId]/generate

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import GenerateClient from "./GenerateClient";
import AppNavbar from "@/components/AppNavbar";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function GeneratePage({ params }: PageProps) {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session?.user?.id) redirect("/login");

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
    include: {
      creatives: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!brand) notFound();

  return (
    <main className="min-h-screen" style={{ background: "var(--sf-bg-primary)" }}>
      <AppNavbar email={session.user?.email} />

      <GenerateClient
        brandId={brand.id}
        brandName={brand.name}
        existingCreatives={brand.creatives.map((c) => ({
          id: c.id,
          imageUrl: c.imageUrl,
          status: c.status,
          score: c.score,
          format: c.format,
          angle: c.angle,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
