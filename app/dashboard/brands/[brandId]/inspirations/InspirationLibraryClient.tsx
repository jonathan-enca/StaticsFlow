"use client";

// InspirationLibraryClient — drag-and-drop upload zone + gallery grid + analysis badges
// Features:
//   - Drag-and-drop or click-to-upload (JPEG/PNG/WebP, 10MB max, 400×400 min)
//   - Upload progress feedback
//   - Gallery grid with status badges (analyzing / analyzed / error)
//   - Per-card: toggle active / delete / trigger re-analysis
//   - Soft gate banner: shows warning when count < 5
//   - Filter bar: by analysis status, hook angle, ad format

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import type { Inspiration } from "@prisma/client";
import { Sparkles, X, Check, Loader2, Link as LinkIcon } from "lucide-react";

const MIN_FOR_GENERATION = 5;
const MAX_PER_BRAND = 50;

interface InspirationAnalysis {
  layoutType?: string;
  hookAngle?: string;
  adFormat?: string;
  mood?: string;
  productCategory?: string;
  analysisQualityScore?: number;
  colorMood?: string;
  subjectFocus?: string;
}

interface Props {
  brandId: string;
  initialInspirations: Inspiration[];
}

// ── Status badge ─────────────────────────────────────────────────────────────
function AnalysisBadge({ inspiration }: { inspiration: Inspiration }) {
  const analysis = inspiration.analysisJson as InspirationAnalysis | null;

  if (inspiration.analyzedAt && analysis?.hookAngle) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "rgba(52,199,89,0.12)", color: "var(--sf-success)" }}>
        ✓ Analyzed
      </span>
    );
  }
  if (!inspiration.imageUrl) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "rgba(255,159,10,0.12)", color: "var(--sf-warning)" }}>
        ⏳ Uploading…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: "rgba(142,142,147,0.12)", color: "var(--sf-text-muted)" }}>
      ○ Not analyzed
    </span>
  );
}

// ── Inspiration card ──────────────────────────────────────────────────────────
function InspirationCard({
  inspiration,
  brandId,
  onDeleted,
  onAnalyzed,
  onToggle,
}: {
  inspiration: Inspiration;
  brandId: string;
  onDeleted: (id: string) => void;
  onAnalyzed: (updated: Inspiration) => void;
  onToggle: (updated: Inspiration) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const analysis = inspiration.analysisJson as InspirationAnalysis | null;

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/inspirations/${inspiration.id}/analyze`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        onAnalyzed(data.inspiration);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleToggleActive() {
    const res = await fetch(
      `/api/brands/${brandId}/inspirations/${inspiration.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !inspiration.isActive }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      onToggle(data.inspiration);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this inspiration? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/inspirations/${inspiration.id}`,
        { method: "DELETE" }
      );
      if (res.ok) onDeleted(inspiration.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="group relative overflow-hidden rounded-xl border transition-all"
      style={{
        background: "var(--sf-bg-secondary)",
        borderColor: inspiration.isActive ? "var(--sf-border)" : "var(--sf-border)",
        opacity: inspiration.isActive ? 1 : 0.5,
      }}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden" style={{ background: "var(--sf-bg-elevated)" }}>
        {(inspiration.thumbnailUrl || inspiration.imageUrl) ? (
          <Image
            src={inspiration.thumbnailUrl ?? inspiration.imageUrl}
            alt="Inspiration creative"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: "var(--sf-text-muted)" }}>
            <svg className="h-8 w-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Active toggle overlay */}
        {!inspiration.isActive && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.4)" }}>
            <span className="rounded-full px-2 py-1 text-xs font-medium text-white"
              style={{ background: "rgba(0,0,0,0.6)" }}>
              Inactive
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-1 flex-wrap">
          <AnalysisBadge inspiration={inspiration} />
          {analysis?.hookAngle && (
            <span className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
              {analysis.hookAngle.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Analysis details */}
        {analysis?.adFormat && (
          <div className="mb-2 flex flex-wrap gap-1">
            {analysis.adFormat && (
              <span className="rounded px-1.5 py-0.5 text-xs"
                style={{ background: "var(--sf-bg-elevated)", color: "var(--sf-text-secondary)" }}>
                {analysis.adFormat}
              </span>
            )}
            {analysis.mood && (
              <span className="rounded px-1.5 py-0.5 text-xs"
                style={{ background: "var(--sf-bg-elevated)", color: "var(--sf-text-secondary)" }}>
                {analysis.mood}
              </span>
            )}
            {analysis.subjectFocus && (
              <span className="rounded px-1.5 py-0.5 text-xs"
                style={{ background: "var(--sf-bg-elevated)", color: "var(--sf-text-secondary)" }}>
                {analysis.subjectFocus}
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-2">
          {!inspiration.analyzedAt && inspiration.imageUrl && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--sf-accent-muted)", color: "var(--sf-accent)" }}
            >
              {analyzing ? "Analyzing…" : "Analyze"}
            </button>
          )}
          {inspiration.analyzedAt && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--sf-bg-elevated)", color: "var(--sf-text-secondary)" }}
            >
              {analyzing ? "Re-analyzing…" : "Re-analyze"}
            </button>
          )}
          <button
            onClick={handleToggleActive}
            className="rounded-lg p-1.5 text-xs transition-opacity hover:opacity-80"
            style={{ background: "var(--sf-bg-elevated)", color: "var(--sf-text-muted)" }}
            title={inspiration.isActive ? "Deactivate" : "Activate"}
          >
            {inspiration.isActive ? "👁" : "⊘"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg p-1.5 text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgba(255,69,58,0.1)", color: "var(--sf-error)" }}
            title="Delete"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({
  brandId,
  count,
  onUploaded,
}: {
  brandId: string;
  count: number;
  onUploaded: (inspiration: Inspiration) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFull = count >= MAX_PER_BRAND;

  async function uploadFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/brands/${brandId}/inspirations`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message ?? data.error ?? "Upload failed");
        return;
      }
      onUploaded(data.inspiration);
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      for (const file of Array.from(files)) {
        if (count + 1 > MAX_PER_BRAND) break;
        await uploadFile(file);
      }
    },
    [brandId, count] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (isFull || uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="mb-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !isFull && !uploading && inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all"
        style={{
          borderColor: dragging ? "var(--sf-accent)" : "var(--sf-border)",
          background: dragging ? "var(--sf-accent-muted)" : "var(--sf-bg-secondary)",
          opacity: isFull || uploading ? 0.6 : 1,
          cursor: isFull || uploading ? "not-allowed" : "pointer",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--sf-accent)", borderTopColor: "transparent" }} />
            <p className="text-sm font-medium" style={{ color: "var(--sf-text-secondary)" }}>
              Uploading…
            </p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--sf-accent-muted)" }}>
              <svg className="h-6 w-6" style={{ color: "var(--sf-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--sf-text-primary)" }}>
              {isFull ? `Library full (${MAX_PER_BRAND}/${MAX_PER_BRAND})` : "Drag & drop ad creatives here, or click to browse"}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--sf-text-muted)" }}>
              JPEG, PNG, WebP · Max 10 MB · Min 400×400 px
            </p>
          </>
        )}
      </div>

      {uploadError && (
        <p className="mt-2 rounded-lg px-3 py-2 text-sm"
          style={{ background: "rgba(255,69,58,0.08)", color: "var(--sf-error)" }}>
          {uploadError}
        </p>
      )}
    </div>
  );
}

// ── Import from URL modal ─────────────────────────────────────────────────────
function ImportFromUrlModal({
  brandId,
  onImported,
  onClose,
}: {
  brandId: string;
  onImported: (inspiration: Inspiration) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setFetching(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/inspirations/import-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Could not fetch that URL automatically. Try saving the image and uploading it directly.");
        return;
      }
      onImported(data.inspiration);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setFetching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleFetch();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: "var(--sf-bg-secondary)", borderColor: "var(--sf-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--sf-border)" }}>
          <div>
            <h2 className="font-bold text-sm" style={{ color: "var(--sf-text-primary)" }}>Import from URL</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--sf-text-muted)" }}>
              Paste a direct image URL or an ad page URL
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--sf-text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com/ad-image.jpg"
              autoFocus
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                background: "var(--sf-bg-primary)",
                borderColor: "var(--sf-border)",
                color: "var(--sf-text-primary)",
              }}
              disabled={fetching}
            />
            <button
              type="button"
              onClick={handleFetch}
              disabled={fetching || !url.trim()}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white flex items-center gap-1.5 disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: "var(--sf-accent)" }}
            >
              {fetching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Fetch"
              )}
            </button>
          </div>

          {error && (
            <p
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: "rgba(255,69,58,0.08)", color: "var(--sf-error)" }}
            >
              {error}
            </p>
          )}

          {/* Hint */}
          <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
            Works great with direct image URLs (.jpg, .png, .webp). For Meta Ads Library, save the ad screenshot manually and upload it — Meta blocks automated fetching.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Starter pack picker ───────────────────────────────────────────────────────

interface TemplateSummary {
  id: string;
  category: string;
  type: string;
  hookType: string;
  thumbnailUrl: string | null;
  sourceImageUrl: string;
}

interface CategoryPreview {
  category: string;
  preview: { id: string; thumbnailUrl: string | null; sourceImageUrl: string } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  skincare: "Skincare", food: "Food & Beverage", fashion: "Fashion",
  tech: "Tech", fitness: "Fitness & Wellness", home: "Home & Living",
  beauty: "Beauty", health: "Health", pet: "Pet", other: "Other",
};

function StarterPackPicker({
  brandId,
  onAdded,
  onClose,
}: {
  brandId: string;
  onAdded: (count: number) => void;
  onClose: () => void;
}) {
  const [categories, setCategories] = useState<CategoryPreview[] | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Load categories on mount
  useState(() => {
    setLoadingCategories(true);
    fetch("/api/starter-packs")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCategories(false));
  });

  async function selectCategory(cat: string) {
    setSelectedCategory(cat);
    setLoadingTemplates(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(`/api/starter-packs?category=${cat}`);
      const d = await res.json();
      setTemplates(d.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }

  function toggleTemplate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/starter-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateIds: Array.from(selectedIds) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to add starter pack");
      onAdded(d.added);
    } catch (e) {
      setAddError((e as Error).message);
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl"
        style={{ background: "var(--sf-bg-secondary)", borderColor: "var(--sf-border)", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--sf-border)" }}>
          <div>
            <h2 className="font-bold text-[var(--sf-text-primary)]">Starter inspiration pack</h2>
            <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">
              Pick a category and select up to 12 pre-curated creatives to add to your library.
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--sf-bg-elevated)] transition-colors">
            <X className="w-5 h-5 text-[var(--sf-text-muted)]" />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 140px)" }}>
          {!selectedCategory ? (
            /* Category grid */
            <div className="p-6">
              {loadingCategories ? (
                <div className="flex items-center justify-center py-12 gap-2 text-[var(--sf-text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading categories…</span>
                </div>
              ) : !categories || categories.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--sf-text-muted)]">
                    No starter packs available yet — upload your own creatives above.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categories.map((c) => (
                    <button
                      key={c.category}
                      type="button"
                      onClick={() => selectCategory(c.category)}
                      className="relative rounded-xl border-2 border-[var(--sf-border)] overflow-hidden text-left hover:border-[var(--sf-accent)] transition-colors group"
                    >
                      <div className="aspect-video bg-[var(--sf-bg-primary)] overflow-hidden">
                        {c.preview && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.preview.thumbnailUrl ?? c.preview.sourceImageUrl}
                            alt=""
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                          />
                        )}
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-sm font-semibold text-[var(--sf-text-primary)]">
                          {CATEGORY_LABELS[c.category] ?? c.category}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Template grid */
            <div className="p-6 space-y-4">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-[var(--sf-accent)] hover:underline"
              >
                ← Back to categories
              </button>
              <p className="text-sm text-[var(--sf-text-secondary)]">
                Select creatives to add · {selectedIds.size} selected
              </p>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12 gap-2 text-[var(--sf-text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading templates…</span>
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-[var(--sf-text-muted)] text-center py-8">
                  No templates found for this category.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {templates.map((t) => {
                    const sel = selectedIds.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTemplate(t.id)}
                        className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                          sel
                            ? "border-[var(--sf-accent)] ring-2 ring-[var(--sf-accent)]/20"
                            : "border-[var(--sf-border)] hover:border-gray-400"
                        }`}
                      >
                        <div className="aspect-square bg-[var(--sf-bg-primary)] overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={t.thumbnailUrl ?? t.sourceImageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {sel && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--sf-accent)] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="px-2 py-1 bg-[var(--sf-bg-secondary)] border-t border-[var(--sf-border)]">
                          <p className="text-xs text-[var(--sf-text-muted)] truncate capitalize">{t.hookType}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: "var(--sf-border)" }}>
          {addError && (
            <p className="text-xs text-[var(--sf-error)] flex-1 mr-4">{addError}</p>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--sf-border)] text-[var(--sf-text-secondary)] hover:border-gray-400 transition-colors">
              Cancel
            </button>
            {selectedCategory && (
              <button
                type="button"
                onClick={handleAdd}
                disabled={selectedIds.size === 0 || adding}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5 disabled:opacity-40 transition-opacity"
                style={{ background: "var(--sf-accent)" }}
              >
                {adding ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Add {selectedIds.size > 0 ? selectedIds.size : ""} to library</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InspirationLibraryClient({ brandId, initialInspirations }: Props) {
  const [inspirations, setInspirations] = useState<Inspiration[]>(initialInspirations);
  const [filterHook, setFilterHook] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showStarterPack, setShowStarterPack] = useState(false);
  const [showImportUrl, setShowImportUrl] = useState(false);

  const activeCount = inspirations.filter((i) => i.isActive).length;

  function handleUploaded(ins: Inspiration) {
    setInspirations((prev) => [ins, ...prev]);
  }

  function handleDeleted(id: string) {
    setInspirations((prev) => prev.filter((i) => i.id !== id));
  }

  function handleAnalyzed(updated: Inspiration) {
    setInspirations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleToggle(updated: Inspiration) {
    setInspirations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  // Collect unique hook angles for filter
  const hookAngles = Array.from(
    new Set(
      inspirations
        .map((i) => (i.analysisJson as InspirationAnalysis | null)?.hookAngle)
        .filter(Boolean) as string[]
    )
  );

  // Collect unique ad formats for filter
  const adFormats = Array.from(
    new Set(
      inspirations
        .map((i) => (i.analysisJson as InspirationAnalysis | null)?.adFormat)
        .filter(Boolean) as string[]
    )
  );

  // Apply filters
  const filtered = inspirations.filter((ins) => {
    const analysis = ins.analysisJson as InspirationAnalysis | null;

    if (filterStatus === "analyzed" && !ins.analyzedAt) return false;
    if (filterStatus === "pending" && ins.analyzedAt) return false;
    if (filterStatus === "inactive" && ins.isActive) return false;

    if (filterHook !== "all" && analysis?.hookAngle !== filterHook) return false;
    if (filterFormat !== "all" && analysis?.adFormat !== filterFormat) return false;

    return true;
  });

  function handleImported(ins: Inspiration) {
    setInspirations((prev) => [ins, ...prev]);
  }

  return (
    <div>
      {/* Starter pack modal */}
      {showStarterPack && (
        <StarterPackPicker
          brandId={brandId}
          onAdded={(count) => {
            // Reload the page to show newly added inspirations (simplest approach — server data)
            window.location.reload();
          }}
          onClose={() => setShowStarterPack(false)}
        />
      )}

      {/* Import from URL modal */}
      {showImportUrl && (
        <ImportFromUrlModal
          brandId={brandId}
          onImported={handleImported}
          onClose={() => setShowImportUrl(false)}
        />
      )}

      {/* Soft gate banner — fewer than MIN_FOR_GENERATION active inspirations */}
      {activeCount < MIN_FOR_GENERATION && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{
            background: "rgba(255,159,10,0.06)",
            borderColor: "rgba(255,159,10,0.3)",
            color: "var(--sf-warning)",
          }}>
          <span className="mt-0.5 text-lg">⚠</span>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {activeCount === 0
                ? "No inspirations yet"
                : `${activeCount} of ${MIN_FOR_GENERATION} required`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sf-text-secondary)" }}>
              Upload at least {MIN_FOR_GENERATION} ad creatives to enable inspiration-driven generation.
              Below that threshold, generation will fall back to the global template library.
            </p>
            <button
              type="button"
              onClick={() => setShowStarterPack(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "var(--sf-accent)", color: "#fff" }}
            >
              <Sparkles className="w-3 h-3" />
              Start with a starter pack
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="mb-6 flex flex-wrap gap-4">
        {[
          { label: "Total", value: inspirations.length },
          { label: "Active", value: activeCount },
          { label: "Analyzed", value: inspirations.filter((i) => i.analyzedAt).length },
          { label: "Remaining", value: Math.max(0, MAX_PER_BRAND - inspirations.length) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border px-4 py-3"
            style={{ background: "var(--sf-bg-secondary)", borderColor: "var(--sf-border)" }}>
            <p className="text-2xl font-bold" style={{ color: "var(--sf-text-primary)" }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sf-text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Upload zone + Import from URL */}
      <UploadZone
        brandId={brandId}
        count={inspirations.length}
        onUploaded={handleUploaded}
      />

      {/* Secondary import actions */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowImportUrl(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{
            borderColor: "var(--sf-border)",
            background: "var(--sf-bg-secondary)",
            color: "var(--sf-text-secondary)",
          }}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Import from URL
        </button>
        <button
          type="button"
          onClick={() => setShowStarterPack(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{
            borderColor: "var(--sf-border)",
            background: "var(--sf-bg-secondary)",
            color: "var(--sf-text-secondary)",
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Starter pack
        </button>
      </div>

      {/* Filter bar */}
      {inspirations.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{
              background: "var(--sf-bg-secondary)",
              borderColor: "var(--sf-border)",
              color: "var(--sf-text-primary)",
            }}
          >
            <option value="all">All statuses</option>
            <option value="analyzed">Analyzed</option>
            <option value="pending">Not analyzed</option>
            <option value="inactive">Inactive</option>
          </select>

          {hookAngles.length > 0 && (
            <select
              value={filterHook}
              onChange={(e) => setFilterHook(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{
                background: "var(--sf-bg-secondary)",
                borderColor: "var(--sf-border)",
                color: "var(--sf-text-primary)",
              }}
            >
              <option value="all">All hooks</option>
              {hookAngles.map((h) => (
                <option key={h} value={h}>{h.replace(/_/g, " ")}</option>
              ))}
            </select>
          )}

          {adFormats.length > 0 && (
            <select
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{
                background: "var(--sf-bg-secondary)",
                borderColor: "var(--sf-border)",
                color: "var(--sf-text-primary)",
              }}
            >
              <option value="all">All formats</option>
              {adFormats.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}

          {filtered.length !== inspirations.length && (
            <span className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
              Showing {filtered.length} of {inspirations.length}
            </span>
          )}

          {(filterHook !== "all" || filterFormat !== "all" || filterStatus !== "all") && (
            <button
              onClick={() => { setFilterHook("all"); setFilterFormat("all"); setFilterStatus("all"); }}
              className="text-xs hover:opacity-80"
              style={{ color: "var(--sf-accent)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Gallery grid */}
      {filtered.length === 0 && inspirations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "var(--sf-bg-elevated)" }}>
            <svg className="h-8 w-8" style={{ color: "var(--sf-text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-base font-medium" style={{ color: "var(--sf-text-secondary)" }}>
            No inspirations yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--sf-text-muted)" }}>
            Upload {MIN_FOR_GENERATION}+ ad creatives to unlock inspiration-driven generation.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--sf-text-muted)" }}>
          No inspirations match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((ins) => (
            <InspirationCard
              key={ins.id}
              inspiration={ins}
              brandId={brandId}
              onDeleted={handleDeleted}
              onAnalyzed={handleAnalyzed}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
