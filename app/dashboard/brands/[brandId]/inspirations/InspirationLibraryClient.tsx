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

// ── Main component ────────────────────────────────────────────────────────────
export default function InspirationLibraryClient({ brandId, initialInspirations }: Props) {
  const [inspirations, setInspirations] = useState<Inspiration[]>(initialInspirations);
  const [filterHook, setFilterHook] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  return (
    <div>
      {/* Soft gate banner — fewer than MIN_FOR_GENERATION active inspirations */}
      {activeCount < MIN_FOR_GENERATION && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{
            background: "rgba(255,159,10,0.06)",
            borderColor: "rgba(255,159,10,0.3)",
            color: "var(--sf-warning)",
          }}>
          <span className="mt-0.5 text-lg">⚠</span>
          <div>
            <p className="text-sm font-semibold">
              {activeCount === 0
                ? "No inspirations yet"
                : `${activeCount} of ${MIN_FOR_GENERATION} required`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sf-text-secondary)" }}>
              Upload at least {MIN_FOR_GENERATION} ad creatives to enable inspiration-driven generation.
              Below that threshold, generation will fall back to the global template library.
            </p>
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

      {/* Upload zone */}
      <UploadZone
        brandId={brandId}
        count={inspirations.length}
        onUploaded={handleUploaded}
      />

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
