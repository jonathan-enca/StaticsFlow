// Inspiration Library page — lists + manages all inspirations for a brand
// Route: /dashboard/brands/[brandId]/inspirations

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import InspirationLibraryClient from "./InspirationLibraryClient";
import type { Inspiration } from "@prisma/client";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function InspirationLibraryPage({ params }: PageProps) {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session?.user?.id) redirect("/login");

  const { brandId } = await params;

  const [brand, userBrands] = await Promise.all([
    prisma.brand.findFirst({
      where: { id: brandId, userId: session.user.id },
      include: {
        inspirations: { orderBy: { uploadedAt: "desc" } },
        products: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.brand.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!brand) notFound();

  return (
    <div className="min-h-screen" style={{ background: "var(--sf-bg-primary)" }}>
      <AppNavbar email={session.user.email} brands={userBrands} isAdmin={session.user?.isAdmin} />

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Breadcrumb + header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div
              className="mb-1 flex items-center gap-2 text-sm"
              style={{ color: "var(--sf-text-muted)" }}
            >
              <Link
                href="/dashboard"
                className="hover:underline"
                style={{ color: "var(--sf-text-muted)" }}
              >
                Dashboard
              </Link>
              <span>/</span>
              <Link
                href={`/dashboard/brands/${brandId}`}
                className="hover:underline"
                style={{ color: "var(--sf-text-muted)" }}
              >
                {brand.name}
              </Link>
              <span>/</span>
              <span>Inspirations</span>
            </div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--sf-text-primary)" }}
            >
              Visual Inspirations Library
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Upload ad creatives that match your visual expectations. These become
              the reference for generation — the more you add, the better the cloning.
            </p>
          </div>
        </div>

        <InspirationLibraryClient
          brandId={brandId}
          initialInspirations={brand.inspirations as Inspiration[]}
          products={brand.products}
        />
      </main>
    </div>
  );
}
