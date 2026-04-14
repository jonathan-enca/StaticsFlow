// Product Library page — lists all products for a brand
// Route: /dashboard/brands/[brandId]/products

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import ProductListClient from "./ProductListClient";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function ProductsPage({ params }: PageProps) {
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
      include: { products: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] } },
    }),
    prisma.brand.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!brand) notFound();

  return (
    <div className="min-h-screen bg-[var(--sf-bg)]">
      <AppNavbar email={session.user.email} brands={userBrands} isAdmin={session.user?.isAdmin} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-[var(--sf-muted)]">
              <Link href="/dashboard" className="hover:text-[var(--sf-text)]">
                Dashboard
              </Link>
              <span>/</span>
              <Link
                href={`/dashboard/brands/${brandId}`}
                className="hover:text-[var(--sf-text)]"
              >
                {brand.name}
              </Link>
              <span>/</span>
              <span>Products</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--sf-text)]">
              Product Library
            </h1>
            <p className="mt-1 text-sm text-[var(--sf-muted)]">
              {brand.products.length === 0
                ? "No products yet — add your first product to unlock on-brand generation."
                : `${brand.products.length} product${brand.products.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            href={`/dashboard/brands/${brandId}/products/new`}
            className="rounded-lg bg-[var(--sf-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add product
          </Link>
        </div>

        <ProductListClient
          brandId={brandId}
          initialProducts={brand.products}
        />
      </main>
    </div>
  );
}
