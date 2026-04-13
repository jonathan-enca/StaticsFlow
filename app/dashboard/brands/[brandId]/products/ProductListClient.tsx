"use client";

// ProductListClient — interactive product list with status indicators
// Shows readiness for generation: min 3 images required (hard), benefits recommended (soft)

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@prisma/client";

interface Props {
  brandId: string;
  initialProducts: Product[];
}

function ProductReadiness({ product }: { product: Product }) {
  const imageCount = product.productImages.length;
  const ready = imageCount >= 3;

  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
        ✓ Ready
      </span>
    );
  }
  if (imageCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
        ⚠ Add 3 images
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
      ⚠ Add {3 - imageCount} more image{3 - imageCount !== 1 ? "s" : ""}
    </span>
  );
}

export default function ProductListClient({ brandId, initialProducts }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function handleSetDefault(productId: string) {
    await fetch(`/api/brands/${brandId}/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setProducts((prev) =>
      prev.map((p) => ({ ...p, isDefault: p.id === productId }))
    );
  }

  async function handleToggleActive(product: Product) {
    await fetch(`/api/brands/${brandId}/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !product.isActive }),
    });
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p))
    );
  }

  async function handleDelete(productId: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setDeleting(productId);
    await fetch(`/api/brands/${brandId}/products/${productId}`, {
      method: "DELETE",
    });
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setDeleting(null);
    router.refresh();
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--sf-border)] p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sf-surface)]">
          <svg className="h-8 w-8 text-[var(--sf-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="mb-2 text-sm font-medium text-[var(--sf-text)]">No products yet</p>
        <p className="mb-6 text-sm text-[var(--sf-muted)]">
          Add your first product to generate on-brand ads with product images, claims, and copy.
        </p>
        <Link
          href={`/dashboard/brands/${brandId}/products/new`}
          className="rounded-lg bg-[var(--sf-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Add your first product
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <div
          key={product.id}
          className={`rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-5 transition-opacity ${
            !product.isActive ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-start gap-4">
            {/* Thumbnail placeholder or first image */}
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--sf-bg)]">
              {product.productImages[0] ? (
                <img
                  src={product.productImages[0]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg className="h-6 w-6 text-[var(--sf-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--sf-text)]">{product.name}</h3>
                {product.isDefault && (
                  <span className="rounded-full bg-[var(--sf-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--sf-accent)]">
                    ★ Default
                  </span>
                )}
                {!product.isActive && (
                  <span className="rounded-full bg-[var(--sf-muted)]/10 px-2 py-0.5 text-xs text-[var(--sf-muted)]">
                    Inactive
                  </span>
                )}
                <ProductReadiness product={product} />
              </div>

              <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--sf-muted)]">
                {product.price && <span>{product.price}{product.currency ? ` ${product.currency}` : ""}</span>}
                {product.productImages.length > 0 && (
                  <span>{product.productImages.length} image{product.productImages.length !== 1 ? "s" : ""}</span>
                )}
                {product.benefits.length > 0 && (
                  <span>{product.benefits.length} benefit{product.benefits.length !== 1 ? "s" : ""}</span>
                )}
                {product.tagline && (
                  <span className="italic truncate max-w-xs">{product.tagline}</span>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-2">
              <Link
                href={`/dashboard/brands/${brandId}/products/${product.id}`}
                className="rounded-lg border border-[var(--sf-border)] px-3 py-1.5 text-xs font-medium text-[var(--sf-text)] hover:bg-[var(--sf-bg)]"
              >
                Edit
              </Link>
              {!product.isDefault && product.isActive && (
                <button
                  onClick={() => handleSetDefault(product.id)}
                  className="rounded-lg border border-[var(--sf-border)] px-3 py-1.5 text-xs font-medium text-[var(--sf-muted)] hover:bg-[var(--sf-bg)] hover:text-[var(--sf-text)]"
                >
                  Set default
                </button>
              )}
              <button
                onClick={() => handleToggleActive(product)}
                className="rounded-lg border border-[var(--sf-border)] px-3 py-1.5 text-xs font-medium text-[var(--sf-muted)] hover:bg-[var(--sf-bg)] hover:text-[var(--sf-text)]"
              >
                {product.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => handleDelete(product.id)}
                disabled={deleting === product.id}
                className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleting === product.id ? "…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
