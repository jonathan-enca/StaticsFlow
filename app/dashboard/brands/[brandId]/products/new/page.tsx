// New Product page — server component shell
// Route: /dashboard/brands/[brandId]/products/new

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import Link from "next/link";
import ProductFormClient from "../ProductFormClient";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function NewProductPage({ params }: PageProps) {
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
  });

  if (!brand) notFound();

  return (
    <div className="min-h-screen bg-[var(--sf-bg)]">
      <AppNavbar email={session.user.email} brandId={brandId} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2 text-sm text-[var(--sf-muted)]">
            <Link href="/dashboard" className="hover:text-[var(--sf-text)]">Dashboard</Link>
            <span>/</span>
            <Link href={`/dashboard/brands/${brandId}`} className="hover:text-[var(--sf-text)]">{brand.name}</Link>
            <span>/</span>
            <Link href={`/dashboard/brands/${brandId}/products`} className="hover:text-[var(--sf-text)]">Products</Link>
            <span>/</span>
            <span>New</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--sf-text)]">Add a product</h1>
          <p className="mt-1 text-sm text-[var(--sf-muted)]">
            Paste a product URL to auto-extract details, or fill in the form manually.
          </p>
        </div>

        <ProductFormClient brandId={brandId} mode="create" />
      </main>
    </div>
  );
}
