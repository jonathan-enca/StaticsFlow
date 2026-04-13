"use client";

// ProductFormClient — Product DNA form (create + edit)
// Features:
//   - URL extraction: paste URL → auto-fills form via Claude + scraper
//   - Extraction result card: compact confirmation after extraction
//   - Image grid: 3-column visual grid replacing flat URL list
//   - Tag inputs for benefits, claims, ingredients, CTAs, hooks, avoids
//   - Image URL management (productImages min 1, lifestyle, packaging, UGC)
//   - Advanced section (collapsible)
//   - Auto-save on submit (not per-field blur — keeps complexity manageable)

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@prisma/client";

interface Props {
  brandId: string;
  mode: "create" | "edit";
  initialProduct?: Product;
}

interface ExtractionResult {
  name: string;
  tagline: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  benefits: string[];
  claims: string[];
  ingredients: string[];
  productImages: string[];
  lifestyleImages: string[];
  packagingImages: string[];
  ugcImages: string[];
  reviewsVerbatim: string[];
  reviewsSummary: string | null;
  productSpecificCTAs: string[];
  productSpecificHooks: string[];
  extractionNotes: string | null;
}

// ── TagInput ──────────────────────────────────────────────────────────────────
function TagInput({
  label,
  tags,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [input, setInput] = useState("");

  function addTag(val: string) {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-[var(--sf-muted)]">{hint}</p>}
      <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] p-2 min-h-[42px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-[var(--sf-surface)] px-3 py-1 text-xs text-[var(--sf-text)]"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-1 text-[var(--sf-muted)] hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
              setInput("");
            }
          }}
          onBlur={() => {
            if (input.trim()) {
              addTag(input);
              setInput("");
            }
          }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="min-w-[140px] flex-1 bg-transparent text-xs text-[var(--sf-text)] outline-none placeholder:text-[var(--sf-muted)]"
        />
      </div>
    </div>
  );
}

// ── ImageGrid ─────────────────────────────────────────────────────────────────
// 3-column visual grid of ~100px thumbnails, each with an overlay remove button.
// URL-paste input stays below the grid.
function ImageGrid({
  urls,
  onChange,
  hint,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  hint?: string;
}) {
  const [input, setInput] = useState("");

  function addUrl(val: string) {
    const trimmed = val.trim();
    if (trimmed && trimmed.startsWith("http") && !urls.includes(trimmed)) {
      onChange([...urls, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="space-y-3">
      {hint && <p className="text-xs text-[var(--sf-muted)]">{hint}</p>}

      {/* 3-column grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {urls.map((url, i) => (
            <div key={i} className="group relative aspect-square w-full overflow-hidden rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)]">
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = "0.3";
                }}
              />
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 text-[10px] leading-none"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* URL paste input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl(input);
            }
          }}
          placeholder="Paste image URL and press Enter"
          className="flex-1 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-xs text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)]"
        />
        <button
          type="button"
          onClick={() => addUrl(input)}
          className="rounded-lg border border-[var(--sf-border)] px-3 py-2 text-xs text-[var(--sf-muted)] hover:bg-[var(--sf-surface)]"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── ImageUrlList ── (kept for lifestyle/packaging/UGC — compact list is fine there)
function ImageUrlList({
  label,
  urls,
  onChange,
  hint,
}: {
  label: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  hint?: string;
}) {
  const [input, setInput] = useState("");

  function addUrl(val: string) {
    const trimmed = val.trim();
    if (trimmed && trimmed.startsWith("http") && !urls.includes(trimmed)) {
      onChange([...urls, trimmed]);
    }
    setInput("");
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-[var(--sf-muted)]">{hint}</p>}
      <div className="space-y-2">
        {urls.map((url, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--sf-border)] bg-[var(--sf-bg)]">
              <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--sf-muted)]">{url}</span>
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl(input);
              }
            }}
            placeholder="Paste image URL and press Enter"
            className="flex-1 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-xs text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)]"
          />
          <button
            type="button"
            onClick={() => addUrl(input)}
            className="rounded-lg border border-[var(--sf-border)] px-3 py-2 text-xs text-[var(--sf-muted)] hover:bg-[var(--sf-surface)]"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ExtractionSkeleton ─────────────────────────────────────────────────────────
// Animated skeleton shown while Claude is analyzing the product page.
function ExtractionSkeleton() {
  return (
    <div className="mt-4 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 animate-pulse">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-[var(--sf-accent)]/40" />
        <div className="h-3 w-48 rounded bg-[var(--sf-border)]" />
      </div>
      <div className="flex gap-2 mb-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 w-20 flex-shrink-0 rounded-lg bg-[var(--sf-border)]" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-3/4 rounded bg-[var(--sf-border)]" />
        <div className="h-2.5 w-1/2 rounded bg-[var(--sf-border)]" />
      </div>
      <p className="mt-3 text-xs text-[var(--sf-muted)]">Analyzing… usually 15–30 seconds</p>
    </div>
  );
}

// ── ExtractionResultCard ───────────────────────────────────────────────────────
// Compact confirmation card shown after a successful extraction.
function ExtractionResultCard({
  result,
  onSaveNow,
}: {
  result: ExtractionResult;
  onSaveNow: () => void;
}) {
  const thumbs = result.productImages.slice(0, 4);
  const stats = [
    result.benefits.length > 0 && `${result.benefits.length} benefits`,
    result.claims.length > 0 && `${result.claims.length} claims`,
    result.reviewsVerbatim.length > 0 && `${result.reviewsVerbatim.length} reviews`,
  ].filter(Boolean);

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-emerald-400 text-sm">✓</span>
        <span className="text-sm font-semibold text-[var(--sf-text)]">{result.name}</span>
        {stats.length > 0 && (
          <span className="text-xs text-[var(--sf-muted)]">— {stats.join(", ")}</span>
        )}
      </div>

      {/* Thumbnail strip */}
      {thumbs.length > 0 && (
        <div className="mb-3 flex gap-2">
          {thumbs.map((url, i) => (
            <div
              key={i}
              className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)]"
            >
              <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
            </div>
          ))}
          {result.productImages.length > 4 && (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] text-xs text-[var(--sf-muted)]">
              +{result.productImages.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Extraction notes from Claude */}
      {result.extractionNotes && (
        <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          ℹ {result.extractionNotes}
        </p>
      )}

      {/* Quick-save CTA */}
      <button
        type="button"
        onClick={onSaveNow}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
      >
        Looks good — save product →
      </button>
      <span className="ml-3 text-xs text-[var(--sf-muted)]">or review &amp; adjust the form below</span>
    </div>
  );
}

// ── Main form component ────────────────────────────────────────────────────────
export default function ProductFormClient({ brandId, mode, initialProduct }: Props) {
  const router = useRouter();

  // Form state — initialized from existing product or empty
  const [sourceUrl, setSourceUrl] = useState(initialProduct?.sourceUrl ?? "");
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [tagline, setTagline] = useState(initialProduct?.tagline ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [price, setPrice] = useState(initialProduct?.price ?? "");
  const [currency, setCurrency] = useState(initialProduct?.currency ?? "");
  const [benefits, setBenefits] = useState<string[]>(initialProduct?.benefits ?? []);
  const [claims, setClaims] = useState<string[]>(initialProduct?.claims ?? []);
  const [ingredients, setIngredients] = useState<string[]>(initialProduct?.ingredients ?? []);
  const [productImages, setProductImages] = useState<string[]>(initialProduct?.productImages ?? []);
  const [lifestyleImages, setLifestyleImages] = useState<string[]>(initialProduct?.lifestyleImages ?? []);
  const [packagingImages, setPackagingImages] = useState<string[]>(initialProduct?.packagingImages ?? []);
  const [ugcImages, setUgcImages] = useState<string[]>(initialProduct?.ugcImages ?? []);
  const [reviewsVerbatim, setReviewsVerbatim] = useState<string[]>(initialProduct?.reviewsVerbatim ?? []);
  const [reviewsSummary, setReviewsSummary] = useState(initialProduct?.reviewsSummary ?? "");
  const [productSpecificCTAs, setProductSpecificCTAs] = useState<string[]>(initialProduct?.productSpecificCTAs ?? []);
  const [productSpecificHooks, setProductSpecificHooks] = useState<string[]>(initialProduct?.productSpecificHooks ?? []);
  const [avoidForThisProduct, setAvoidForThisProduct] = useState<string[]>(initialProduct?.avoidForThisProduct ?? []);
  const [isDefault, setIsDefault] = useState(initialProduct?.isDefault ?? false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extraction state
  const [extractUrl, setExtractUrl] = useState(initialProduct?.sourceUrl ?? "");
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [lastExtraction, setLastExtraction] = useState<ExtractionResult | null>(null);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleExtract() {
    if (!extractUrl.trim()) return;
    setExtracting(true);
    setExtractionError(null);
    setLastExtraction(null);

    try {
      const res = await fetch(`/api/brands/${brandId}/products/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extractUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        setExtractionError(err.message ?? "Extraction failed. Fill in the form manually.");
        return;
      }

      const { extraction }: { extraction: ExtractionResult } = await res.json();

      // Pre-fill form with extracted data (never overwrite if user already typed)
      if (!name && extraction.name) setName(extraction.name);
      if (!tagline && extraction.tagline) setTagline(extraction.tagline);
      if (!description && extraction.description) setDescription(extraction.description);
      if (!price && extraction.price) setPrice(extraction.price);
      if (!currency && extraction.currency) setCurrency(extraction.currency);
      if (benefits.length === 0 && extraction.benefits.length > 0) setBenefits(extraction.benefits);
      if (claims.length === 0 && extraction.claims.length > 0) setClaims(extraction.claims);
      if (ingredients.length === 0 && extraction.ingredients.length > 0) setIngredients(extraction.ingredients);
      if (productImages.length === 0 && extraction.productImages.length > 0) setProductImages(extraction.productImages.slice(0, 8));
      if (lifestyleImages.length === 0 && extraction.lifestyleImages.length > 0) setLifestyleImages(extraction.lifestyleImages.slice(0, 5));
      if (packagingImages.length === 0 && extraction.packagingImages.length > 0) setPackagingImages(extraction.packagingImages.slice(0, 3));
      if (reviewsVerbatim.length === 0 && extraction.reviewsVerbatim.length > 0) setReviewsVerbatim(extraction.reviewsVerbatim.slice(0, 10));
      if (!reviewsSummary && extraction.reviewsSummary) setReviewsSummary(extraction.reviewsSummary);
      if (productSpecificCTAs.length === 0 && extraction.productSpecificCTAs.length > 0) setProductSpecificCTAs(extraction.productSpecificCTAs);
      if (productSpecificHooks.length === 0 && extraction.productSpecificHooks.length > 0) setProductSpecificHooks(extraction.productSpecificHooks);

      // Always update sourceUrl and store the extraction result for the card
      setSourceUrl(extractUrl);
      setLastExtraction(extraction);
    } catch {
      setExtractionError("Network error. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setSaveError("Product name is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      tagline: tagline.trim() || undefined,
      price: price.trim() || undefined,
      currency: currency.trim() || undefined,
      benefits,
      claims,
      ingredients,
      productImages,
      lifestyleImages,
      packagingImages,
      ugcImages,
      reviewsVerbatim,
      reviewsSummary: reviewsSummary.trim() || undefined,
      productSpecificCTAs,
      productSpecificHooks,
      avoidForThisProduct,
      isDefault,
      extractionStatus: sourceUrl ? "done" : "pending",
      extractedAt: sourceUrl ? new Date().toISOString() : undefined,
    };

    const url =
      mode === "create"
        ? `/api/brands/${brandId}/products`
        : `/api/brands/${brandId}/products/${initialProduct!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "Save failed.");
        return;
      }

      router.push(`/dashboard/brands/${brandId}/products`);
      router.refresh();
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // P0-Fix3: Hard-block only at 0 images. Amber nudge for < 3.
  const hasImages = productImages.length >= 1;
  const imageNudge = productImages.length > 0 && productImages.length < 3;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* URL Extraction */}
      <section className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
        <h2 className="mb-1 text-sm font-semibold text-[var(--sf-text)]">Product page URL</h2>
        <p className="mb-4 text-xs text-[var(--sf-muted)]">
          Paste your product URL to auto-fill the form with extracted data.
        </p>
        <div className="flex gap-3">
          <input
            type="url"
            value={extractUrl}
            onChange={(e) => setExtractUrl(e.target.value)}
            placeholder="https://yourstore.com/products/vitamin-c-serum"
            className="flex-1 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-sm text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)]"
          />
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting || !extractUrl.trim()}
            className="rounded-lg bg-[var(--sf-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "Extract →"}
          </button>
        </div>

        {/* P1-Fix4: Skeleton loader during extraction */}
        {extracting && <ExtractionSkeleton />}

        {extractionError && (
          <p className="mt-3 text-xs text-red-400">{extractionError}</p>
        )}

        {/* P0-Fix1: Extraction result card */}
        {!extracting && lastExtraction && (
          <ExtractionResultCard
            result={lastExtraction}
            onSaveNow={() => handleSubmit()}
          />
        )}

        {!lastExtraction && !extracting && (
          <div className="mt-3 text-xs text-[var(--sf-muted)]">or fill in the form below manually</div>
        )}
      </section>

      {/* Core product info */}
      <section className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 space-y-5">
        <h2 className="text-sm font-semibold text-[var(--sf-text)]">Product info</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
              Product name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Vitamin C Brightening Serum"
              className="w-full rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-sm text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
              Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Glow in 7 days, guaranteed."
              className="w-full rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-sm text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Full product description…"
            className="w-full rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-sm text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)] resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
              Price
            </label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="€49.90"
              className="w-full rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-sm text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-sm text-[var(--sf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)]"
            >
              <option value="">Select…</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
        </div>
      </section>

      {/* Product images — P0-Fix2: visual grid, P0-Fix3: min 1, P1-Fix5: pro tip */}
      <section className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--sf-text)]">
              Product images{" "}
              {productImages.length === 0 ? (
                <span className="text-red-400">required</span>
              ) : imageNudge ? (
                <span className="text-amber-400">{productImages.length} added</span>
              ) : (
                <span className="text-emerald-400">✓ {productImages.length} added</span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--sf-muted)]">
              Packshots and product-focused photos. At least 1 required; 3+ recommended for best results.
            </p>
          </div>
          {imageNudge && (
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
              3+ recommended
            </span>
          )}
        </div>

        {/* P0-Fix2: ImageGrid replaces flat URL list */}
        <ImageGrid
          urls={productImages}
          onChange={setProductImages}
          hint="Paste absolute image URLs (https://…). Extracted URLs from your product page appear here automatically."
        />

        {/* P1-Fix5: Transparent background tip */}
        <p className="mt-3 text-xs text-[var(--sf-muted)]">
          Pro tip: PNG product images with transparent background produce the best results in generated ads.
        </p>
      </section>

      {/* Benefits & Claims */}
      <section className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 space-y-5">
        <h2 className="text-sm font-semibold text-[var(--sf-text)]">Benefits & claims</h2>
        <TagInput
          label="Key Benefits"
          tags={benefits}
          onChange={setBenefits}
          placeholder="Reduces fine lines, Brightens skin tone…"
          hint="Specific outcomes your product delivers. At least 2 recommended."
        />
        <TagInput
          label="Claims & Proofs"
          tags={claims}
          onChange={setClaims}
          placeholder="Dermatologist tested, SPF50, Vegan…"
          hint="Certifications, proofs, and claims that validate the product."
        />
      </section>

      {/* Advanced */}
      <section className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)]">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between p-6 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-[var(--sf-text)]">
              Advanced — ingredients, lifestyle images, copy intelligence
            </h2>
            <p className="mt-0.5 text-xs text-[var(--sf-muted)]">
              Optional — enriches generation quality significantly
            </p>
          </div>
          <span className="text-[var(--sf-muted)]">{showAdvanced ? "▲" : "▼"}</span>
        </button>

        {showAdvanced && (
          <div className="space-y-6 border-t border-[var(--sf-border)] px-6 pb-6 pt-5">
            <TagInput
              label="Ingredients"
              tags={ingredients}
              onChange={setIngredients}
              placeholder="Vitamin C 15%, Hyaluronic Acid, Niacinamide…"
            />

            <ImageUrlList
              label="Lifestyle images"
              urls={lifestyleImages}
              onChange={setLifestyleImages}
              hint="In-context shots showing the product in use."
            />
            <ImageUrlList
              label="Packaging images"
              urls={packagingImages}
              onChange={setPackagingImages}
              hint="Packaging-focused shots."
            />
            <ImageUrlList
              label="UGC images"
              urls={ugcImages}
              onChange={setUgcImages}
              hint="User-generated content photos."
            />

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
                Customer reviews (verbatim, max 10)
              </label>
              <TagInput
                label=""
                tags={reviewsVerbatim}
                onChange={(tags) => setReviewsVerbatim(tags.slice(0, 10))}
                placeholder="Paste a customer quote…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--sf-muted)] uppercase tracking-wide">
                Reviews summary
              </label>
              <textarea
                value={reviewsSummary}
                onChange={(e) => setReviewsSummary(e.target.value)}
                rows={2}
                placeholder="Overall customers love the brightening effect and lightweight texture…"
                className="w-full rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-sm text-[var(--sf-text)] placeholder:text-[var(--sf-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-accent)] resize-none"
              />
            </div>

            <TagInput
              label="Product-specific CTAs"
              tags={productSpecificCTAs}
              onChange={setProductSpecificCTAs}
              placeholder="Shop the Serum, Try Risk-Free, Get 20% Off…"
              hint="Overrides Brand DNA CTAs for this product."
            />
            <TagInput
              label="Product-specific hooks"
              tags={productSpecificHooks}
              onChange={setProductSpecificHooks}
              placeholder="transformation, dermatologist-approved, bestseller…"
              hint="Marketing angles that work especially well for this product."
            />
            <TagInput
              label="Avoid for this product"
              tags={avoidForThisProduct}
              onChange={setAvoidForThisProduct}
              placeholder="anti-aging (prefer glow), clinical (too cold)…"
              hint="Words, tones, or angles to avoid specifically for this product."
            />
          </div>
        )}
      </section>

      {/* Default toggle */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-5 py-4">
        <input
          id="isDefault"
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--sf-border)] accent-[var(--sf-accent)]"
        />
        <label htmlFor="isDefault" className="text-sm text-[var(--sf-text)]">
          Set as default product{" "}
          <span className="text-xs text-[var(--sf-muted)]">
            (auto-selected in generation wizard)
          </span>
        </label>
      </div>

      {/* Errors + submit */}
      {saveError && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{saveError}</p>
      )}

      {/* P0-Fix3: amber nudge at 1–2 images, no hard block */}
      {imageNudge && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          3+ product images recommended for best ad generation quality.
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !hasImages}
          className="rounded-lg bg-[var(--sf-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          title={!hasImages ? "Add at least 1 product image to save" : undefined}
        >
          {saving ? "Saving…" : mode === "create" ? "Save product" : "Update product"}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg border border-[var(--sf-border)] px-6 py-2.5 text-sm font-medium text-[var(--sf-muted)] hover:bg-[var(--sf-surface)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
