// /admin/users/[userId]/brands/[brandId] — Admin view of a single brand.
// Server component. Auth enforced by parent /admin/layout.tsx.
// Loads brand + products + creatives, renders the admin brand editor client.

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdminBrandViewClient from "./AdminBrandViewClient";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";

interface PageProps {
  params: Promise<{ userId: string; brandId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminBrandPage({ params, searchParams }: PageProps) {
  await requireAdmin();

  const { userId, brandId } = await params;
  const { page: pageStr } = await searchParams;
  const creativePage = Math.max(1, parseInt(pageStr ?? "1", 10));
  const creativeLimit = 24;

  // Fetch user to confirm existence
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) notFound();

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId },
  });
  if (!brand) notFound();

  const [products, creatives, creativeCount] = await Promise.all([
    prisma.product.findMany({
      where: { brandId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        isDefault: true,
        isActive: true,
        extractionStatus: true,
        createdAt: true,
        _count: { select: { creatives: true } },
      },
    }),
    prisma.creative.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      skip: (creativePage - 1) * creativeLimit,
      take: creativeLimit,
      select: {
        id: true,
        imageUrl: true,
        status: true,
        score: true,
        format: true,
        angle: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.creative.count({ where: { brandId } }),
  ]);

  const dna = (brand.brandDnaJson ?? {}) as unknown as ExtractedBrandDNA;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs mb-6" style={{ color: "var(--sf-text-muted)" }}>
        <Link href="/admin/accounts" className="hover:opacity-80">
          Accounts
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/admin/users/${userId}`} className="hover:opacity-80">
          {user.name ?? user.email}
        </Link>
        <span className="mx-2">/</span>
        <span style={{ color: "var(--sf-text-primary)" }}>{brand.name}</span>
      </nav>

      <AdminBrandViewClient
        userId={userId}
        brandId={brand.id}
        brandName={brand.name}
        brandUrl={brand.url}
        dna={dna}
        products={products.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
        creatives={creatives.map((c) => ({ ...c, status: c.status as string, createdAt: c.createdAt.toISOString() }))}
        creativePagination={{
          total: creativeCount,
          page: creativePage,
          limit: creativeLimit,
          pages: Math.ceil(creativeCount / creativeLimit),
        }}
      />
    </div>
  );
}
