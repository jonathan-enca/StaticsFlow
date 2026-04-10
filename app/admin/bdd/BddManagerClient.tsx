"use client";

// BDD Manager — client-side interactive component
// Features:
//   1. Drag-and-drop (or click) upload zone for multiple images
//   2. Per-file progress indicator + status (uploading / analyzing / done / error)
//   3. Library grid showing all templates with their analysis tags
//   4. Filter bar: category, type, hook_type
//
// Data flow:
//   Upload: POST /api/admin/bdd/upload (multipart) → triggers background Claude analysis
//   Library: GET /api/admin/bdd/creatives?... (paginated, filterable)
//   Re-analyze: POST /api/admin/bdd/analyze { templateId }

import { useCallback, useEffect, useRef, useState } from "react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
type AnalysisStatus = "pending" | "analyzing" | "done" | "error";

interface UploadItem {
  file: File;
  id: string; // local temp id before server id is known
  serverId?: string;
  status: "uploading" | AnalysisStatus;
  progress: number; // 0–100
  error?: string;
  imageUrl?: string;
}

interface Template {
  id: string;
  category: string;
  type: string;
  layout: string;
  hookType: string;
  palette: string[];
  language: string;
  sourceImageUrl: string;
  thumbnailUrl: string | null;
  analyzedAt: string | null;
  uploadedAt: string;
}

interface LibraryResponse {
  templates: Template[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  "all", "skincare", "food", "fashion", "tech", "fitness",
  "home", "beauty", "health", "pet", "other",
];
const TYPE_OPTIONS = [
  "all", "product_hero", "before_after", "comparatif", "testimonial", "promo",
  "ugc_screenshot", "lifestyle", "data_stats", "listicle", "press_mention",
];
const HOOK_OPTIONS = [
  "all", "pain", "curiosite", "social_proof", "fomo",
  "benefice_direct", "autorite", "urgence",
];

const BADGE_COLORS: Record<string, string> = {
  skincare: "bg-pink-100 text-pink-700",
  food: "bg-orange-100 text-orange-700",
  fashion: "bg-purple-100 text-purple-700",
  tech: "bg-blue-100 text-blue-700",
  fitness: "bg-green-100 text-green-700",
  home: "bg-yellow-100 text-yellow-700",
  beauty: "bg-rose-100 text-rose-700",
  health: "bg-teal-100 text-teal-700",
  pet: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-600",
  pain: "bg-red-100 text-red-700",
  curiosite: "bg-indigo-100 text-indigo-700",
  social_proof: "bg-emerald-100 text-emerald-700",
  fomo: "bg-orange-100 text-orange-700",
  benefice_direct: "bg-green-100 text-green-700",
  autorite: "bg-blue-100 text-blue-700",
  urgence: "bg-red-100 text-red-700",
};

function badge(value: string) {
  const color = BADGE_COLORS[value] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      key={value}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}
    >
      {value}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────
export function BddManagerClient() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterHook, setFilterHook] = useState("all");
  const [filterAnalyzed, setFilterAnalyzed] = useState("all");

  // ──────────────────────────────────────────────────────────
  // Library fetch
  // ──────────────────────────────────────────────────────────
  const fetchLibrary = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "50" });
        if (filterCategory !== "all") params.set("category", filterCategory);
        if (filterType !== "all") params.set("type", filterType);
        if (filterHook !== "all") params.set("hookType", filterHook);
        if (filterAnalyzed !== "all") params.set("analyzed", filterAnalyzed);

        const res = await fetch(`/api/admin/bdd/creatives?${params}`);
        if (!res.ok) throw new Error("Failed to load library");
        const data: LibraryResponse = await res.json();
        setTemplates(data.templates);
        setPagination(data.pagination);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [filterCategory, filterType, filterHook, filterAnalyzed]
  );

  useEffect(() => {
    fetchLibrary(1);
  }, [fetchLibrary]);

  // ──────────────────────────────────────────────────────────
  // Upload handling
  // ──────────────────────────────────────────────────────────
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Create upload items immediately for progress UI
    const newItems: UploadItem[] = files.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: "uploading",
      progress: 0,
    }));
    setUploads((prev) => [...newItems, ...prev]);

    // Upload in batches of 5 to avoid overwhelming the server
    const BATCH_SIZE = 5;
    for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
      const batch = newItems.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      batch.forEach((item) => formData.append("files", item.file));

      // Simulate progress pulse during upload
      const progressTimer = setInterval(() => {
        setUploads((prev) =>
          prev.map((u) =>
            batch.some((b) => b.id === u.id) && u.status === "uploading"
              ? { ...u, progress: Math.min(u.progress + 10, 80) }
              : u
          )
        );
      }, 200);

      try {
        const res = await fetch("/api/admin/bdd/upload", {
          method: "POST",
          body: formData,
        });
        clearInterval(progressTimer);

        const data = await res.json();

        // Match server results back to local items by position in batch
        batch.forEach((item, idx) => {
          const uploaded = data.uploaded?.[idx];
          const serverErr = data.errors?.find(
            (_: unknown, errIdx: number) => errIdx === idx - (data.uploaded?.length ?? 0)
          );

          setUploads((prev) =>
            prev.map((u) => {
              if (u.id !== item.id) return u;
              if (uploaded) {
                return {
                  ...u,
                  serverId: uploaded.id,
                  imageUrl: uploaded.sourceImageUrl,
                  status: "analyzing",
                  progress: 90,
                };
              }
              return {
                ...u,
                status: "error",
                progress: 100,
                error: serverErr?.error ?? "Upload failed",
              };
            })
          );
        });

        // Poll for analysis completion for uploaded items
        data.uploaded?.forEach((uploaded: { id: string }) => {
          pollAnalysis(uploaded.id);
        });
      } catch (err) {
        clearInterval(progressTimer);
        batch.forEach((item) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? { ...u, status: "error", progress: 100, error: String(err) }
                : u
            )
          );
        });
      }
    }
  }, []);

  // Poll until analysis completes or errors (max 30s)
  const pollAnalysis = useCallback(
    (templateId: string, attempts = 0) => {
      if (attempts > 15) {
        setUploads((prev) =>
          prev.map((u) =>
            u.serverId === templateId
              ? { ...u, status: "error", error: "Analysis timed out", progress: 100 }
              : u
          )
        );
        return;
      }

      setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/admin/bdd/creatives?limit=1&page=1`
          );
          // Check if this specific template is now analyzed
          const checkRes = await fetch(
            `/api/admin/bdd/creatives?analyzed=true&limit=200`
          );
          const data = await checkRes.json();
          const found = data.templates?.find(
            (t: Template) => t.id === templateId
          );

          if (found?.analyzedAt) {
            setUploads((prev) =>
              prev.map((u) =>
                u.serverId === templateId
                  ? { ...u, status: "done", progress: 100 }
                  : u
              )
            );
            // Refresh library
            fetchLibrary(1);
          } else {
            pollAnalysis(templateId, attempts + 1);
          }
        } catch {
          pollAnalysis(templateId, attempts + 1);
        }
      }, 2000);
    },
    [fetchLibrary]
  );

  // ──────────────────────────────────────────────────────────
  // Drag-and-drop handlers
  // ──────────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    processFiles(files);
  };
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processFiles(files);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  };

  // ──────────────────────────────────────────────────────────
  // Re-analyze
  // ──────────────────────────────────────────────────────────
  const reAnalyze = async (templateId: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, analyzedAt: null } : t))
    );
    await fetch("/api/admin/bdd/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    fetchLibrary(pagination.page);
  };

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">BDD Manager</h1>
        <p className="text-gray-500 mt-1">
          Upload ad creatives in bulk. Claude analyses each one automatically.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors mb-6 ${
          isDragging
            ? "border-black bg-gray-100"
            : "border-gray-300 hover:border-gray-400 bg-white"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onFileInputChange}
        />
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0-3 3m3-3 3 3M6.5 19h11a2 2 0 002-2v-5l-3-3H6.5A1.5 1.5 0 005 10.5v6.5A1.5 1.5 0 006.5 19z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">
          {isDragging
            ? "Drop images here"
            : "Drag & drop images here, or click to browse"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          JPG, PNG, WebP, GIF — up to 20 MB each — multiple files supported
        </p>
      </div>

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div className="mb-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Upload queue ({uploads.length} files)
            </span>
            <button
              onClick={() =>
                setUploads((prev) =>
                  prev.filter((u) => u.status !== "done" && u.status !== "error")
                )
              }
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear completed
            </button>
          </div>
          <ul className="divide-y divide-gray-50">
            {uploads.slice(0, 20).map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-center gap-3">
                {/* Thumbnail preview */}
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0" />
                )}

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.file.name}
                  </p>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.status === "error"
                          ? "bg-red-400"
                          : item.status === "done"
                          ? "bg-green-500"
                          : "bg-black"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0 text-xs font-medium">
                  {item.status === "uploading" && (
                    <span className="text-gray-500">Uploading…</span>
                  )}
                  {item.status === "analyzing" && (
                    <span className="text-blue-600">Analysing…</span>
                  )}
                  {item.status === "done" && (
                    <span className="text-green-600">Done ✓</span>
                  )}
                  {item.status === "error" && (
                    <span className="text-red-600" title={item.error}>
                      Error
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t}
            </option>
          ))}
        </select>

        <select
          value={filterHook}
          onChange={(e) => setFilterHook(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black"
        >
          {HOOK_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h === "all" ? "All hooks" : h}
            </option>
          ))}
        </select>

        <select
          value={filterAnalyzed}
          onChange={(e) => setFilterAnalyzed(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="all">All statuses</option>
          <option value="true">Analysed</option>
          <option value="false">Pending analysis</option>
        </select>

        <button
          onClick={() => fetchLibrary(1)}
          className="text-sm px-4 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Refresh
        </button>

        <span className="ml-auto text-sm text-gray-400 self-center">
          {pagination.total} creative{pagination.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Library grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <p className="text-gray-500 text-sm">
            No creatives yet. Upload your first batch above.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-gray-300 transition-colors"
              >
                {/* Image */}
                <div className="aspect-square bg-gray-50 overflow-hidden">
                  <img
                    src={t.thumbnailUrl ?? t.sourceImageUrl}
                    alt={`${t.category} — ${t.type}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                {/* Tags */}
                <div className="p-2 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {badge(t.category)}
                    {badge(t.hookType)}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{t.type}</p>
                  {/* Palette swatches */}
                  {t.palette.length > 0 && (
                    <div className="flex gap-1">
                      {t.palette.map((hex) => (
                        <span
                          key={hex}
                          className="w-4 h-4 rounded-full border border-white shadow-sm flex-shrink-0"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  )}
                  {/* Analysis status */}
                  {!t.analyzedAt && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-amber-600">Pending…</span>
                      <button
                        onClick={() => reAnalyze(t.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Re-analyse
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLibrary(pagination.page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchLibrary(pagination.page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
