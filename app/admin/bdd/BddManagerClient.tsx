"use client";

// BDD Manager — client-side interactive component
// Features:
//   1. Drag-and-drop (or click) upload zone for multiple images
//   2. Per-file progress indicator + status (uploading / analyzing / done / error)
//   3. Library grid showing all templates with their analysis tags
//   4. Filter bar: category, type, hook_type
//   5. Click-to-edit modal: view + correct analysis fields for any template
//
// Data flow:
//   Upload: POST /api/admin/bdd/upload (multipart) → triggers background Claude analysis
//   Library: GET /api/admin/bdd/creatives?... (paginated, filterable)
//   Re-analyze: POST /api/admin/bdd/analyze { templateId }
//   Edit: PATCH /api/admin/bdd/creatives/[templateId] { category, type, … }

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
  fashion: "bg-violet-100 text-violet-700",
  tech: "bg-blue-100 text-blue-700",
  fitness: "bg-green-100 text-green-700",
  home: "bg-yellow-100 text-yellow-700",
  beauty: "bg-rose-100 text-rose-700",
  health: "bg-teal-100 text-teal-700",
  pet: "bg-amber-100 text-amber-700",
  other: "bg-[var(--sf-bg-elevated)] text-[var(--sf-text-secondary)]",
  pain: "bg-red-100 text-red-700",
  curiosite: "bg-indigo-100 text-indigo-700",
  social_proof: "bg-emerald-100 text-emerald-700",
  fomo: "bg-orange-100 text-orange-700",
  benefice_direct: "bg-green-100 text-green-700",
  autorite: "bg-blue-100 text-blue-700",
  urgence: "bg-red-100 text-red-700",
};

function badge(value: string) {
  const color = BADGE_COLORS[value] ?? "bg-[var(--sf-bg-elevated)] text-[var(--sf-text-secondary)]";
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
// Edit modal
// ──────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = { fr: "🇫🇷 FR", en: "🇬🇧 EN", de: "🇩🇪 DE", other: "🌐 Other" };

interface EditModalProps {
  template: Template;
  onClose: () => void;
  onSaved: (updated: Template) => void;
}

function EditModal({ template, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    category: template.category,
    type:     template.type,
    layout:   template.layout,
    hookType: template.hookType,
    language: template.language,
    palette:  template.palette,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bdd/creatives/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      onSaved(data.template as Template);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof typeof form,
    options: string[]
  ) => (
    <div key={key}>
      <label className="block text-xs font-medium text-[var(--sf-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </label>
      <select
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full text-sm border border-[var(--sf-border)] rounded-lg px-3 py-2 bg-[var(--sf-bg-primary)] focus:outline-none focus:ring-2 focus:ring-black"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {key === "language" ? (LANG_LABELS[o] ?? o) : o}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--sf-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative bg-[var(--sf-bg-elevated)] rounded-t-2xl overflow-hidden max-h-72">
          <img
            src={template.thumbnailUrl ?? template.sourceImageUrl}
            alt="creative"
            className="w-full h-full object-contain"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
          {template.analyzedAt && (
            <span className="absolute top-3 left-3 px-2 py-0.5 text-xs bg-green-600 text-white rounded-full font-medium">
              Analysed
            </span>
          )}
        </div>

        {/* Fields */}
        <div className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--sf-text-primary)]">
            Edit analysis
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {field("Category", "category", [
              "skincare","food","fashion","tech","fitness","home","beauty","health","pet","other",
            ])}
            {field("Type", "type", [
              "product_hero","before_after","comparatif","testimonial","promo",
              "ugc_screenshot","lifestyle","data_stats","listicle","press_mention",
            ])}
            {field("Layout", "layout", ["grid","split","centered","overlay","other"])}
            {field("Hook", "hookType", [
              "pain","curiosite","social_proof","fomo","benefice_direct","autorite","urgence",
            ])}
            {field("Language", "language", ["fr","en","de","other"])}
          </div>

          {/* Palette swatches (read-only display, updated by re-analysis) */}
          {form.palette.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--sf-text-muted)] uppercase tracking-wide mb-1">
                Palette (re-analyse to update)
              </p>
              <div className="flex gap-2">
                {form.palette.map((hex) => (
                  <div key={hex} className="flex items-center gap-1.5">
                    <span
                      className="w-6 h-6 rounded-full border border-[var(--sf-border)]"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-xs text-[var(--sf-text-secondary)] font-mono">{hex}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium border border-[var(--sf-border)] rounded-xl hover:bg-[var(--sf-bg-elevated)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────
interface FolderConfirm {
  files: File[];
  total: number;
}

interface FolderProgress {
  done: number;
  total: number;
}

export function BddManagerClient() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [folderConfirm, setFolderConfirm] = useState<FolderConfirm | null>(null);
  const [folderProgress, setFolderProgress] = useState<FolderProgress | null>(null);

  // Library state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterHook, setFilterHook] = useState("all");
  const [filterAnalyzed, setFilterAnalyzed] = useState("all");

  // Edit modal
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);

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

  // webkitdirectory is not in React's type definitions — set it imperatively
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
    }
  }, []);

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

  // Folder import: upload in batches of 10 with overall progress tracking
  const processFolderImport = useCallback(
    async (files: File[]) => {
      const total = files.length;
      setFolderConfirm(null);
      setFolderProgress({ done: 0, total });

      const BATCH_SIZE = 10;
      let done = 0;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const formData = new FormData();
        batch.forEach((f) => formData.append("files", f));

        try {
          const res = await fetch("/api/admin/bdd/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          done += data.success ?? batch.length;
        } catch {
          done += batch.length; // keep progress moving even on network error
        }

        setFolderProgress({ done, total });
      }

      // Brief completion pause then reset and refresh library
      setTimeout(() => {
        setFolderProgress(null);
        fetchLibrary(1);
      }, 2000);
    },
    [fetchLibrary]
  );

  const onFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    e.target.value = "";
    if (files.length === 0) return;
    setFolderConfirm({ files, total: files.length });
  };

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

  // Update a template in-place after edit save
  const handleTemplateSaved = useCallback((updated: Template) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Edit modal */}
      {editTemplate && (
        <EditModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={handleTemplateSaved}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--sf-text-primary)]">BDD Manager</h1>
        <p className="text-[var(--sf-text-secondary)] mt-1">
          Upload ad creatives in bulk. Claude analyses each one automatically.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-black bg-[var(--sf-bg-elevated)]"
            : "border-[var(--sf-border)] hover:border-[var(--sf-border)] bg-[var(--sf-bg-secondary)]"
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
        <div className="w-12 h-12 rounded-xl bg-[var(--sf-bg-elevated)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[var(--sf-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0-3 3m3-3 3 3M6.5 19h11a2 2 0 002-2v-5l-3-3H6.5A1.5 1.5 0 005 10.5v6.5A1.5 1.5 0 006.5 19z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--sf-text-primary)]">
          {isDragging
            ? "Drop images here"
            : "Drag & drop images here, or click to browse"}
        </p>
        <p className="text-xs text-[var(--sf-text-muted)] mt-1">
          JPG, PNG, WebP, GIF — up to 20 MB each — multiple files supported
        </p>
      </div>

      {/* Folder import button + hidden folder input */}
      <div className="mt-3 mb-6 flex items-center gap-3">
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onFolderInputChange}
        />
        <button
          onClick={() => folderInputRef.current?.click()}
          disabled={!!folderProgress}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[var(--sf-border)] rounded-lg bg-[var(--sf-bg-secondary)] hover:bg-[var(--sf-bg-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 text-[var(--sf-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          Import folder
        </button>
        <p className="text-xs text-[var(--sf-text-muted)]">
          Select a folder to import thousands of images at once
        </p>
      </div>

      {/* Folder confirmation banner */}
      {folderConfirm && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-4">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-semibold">{folderConfirm.total.toLocaleString()} images detected</span> — ready to import?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFolderConfirm(null)}
              className="px-3 py-1.5 text-xs font-medium text-[var(--sf-text-secondary)] border border-[var(--sf-border)] rounded-lg bg-[var(--sf-bg-secondary)] hover:bg-[var(--sf-bg-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={() => processFolderImport(folderConfirm.files)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-black rounded-lg hover:bg-gray-800"
            >
              Start import
            </button>
          </div>
        </div>
      )}

      {/* Overall folder import progress */}
      {folderProgress && (
        <div className="mb-6 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[var(--sf-text-primary)]">
              Importing folder…
            </span>
            <span className="text-sm text-[var(--sf-text-secondary)]">
              {folderProgress.done.toLocaleString()} / {folderProgress.total.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-[var(--sf-bg-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-300"
              style={{ width: `${Math.round((folderProgress.done / folderProgress.total) * 100)}%` }}
            />
          </div>
          {folderProgress.done >= folderProgress.total && (
            <p className="text-xs text-green-600 mt-2">Import complete ✓</p>
          )}
        </div>
      )}

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div className="mb-8 bg-[var(--sf-bg-secondary)] rounded-xl border border-[var(--sf-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--sf-border)] flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--sf-text-primary)]">
              Upload queue ({uploads.length} files)
            </span>
            <button
              onClick={() =>
                setUploads((prev) =>
                  prev.filter((u) => u.status !== "done" && u.status !== "error")
                )
              }
              className="text-xs text-[var(--sf-text-muted)] hover:text-[var(--sf-text-secondary)]"
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
                  <div className="w-10 h-10 rounded bg-[var(--sf-bg-elevated)] flex-shrink-0" />
                )}

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sf-text-primary)] truncate">
                    {item.file.name}
                  </p>
                  <div className="mt-1 h-1.5 bg-[var(--sf-bg-elevated)] rounded-full overflow-hidden">
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
                    <span className="text-[var(--sf-text-secondary)]">Uploading…</span>
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
          className="text-sm border border-[var(--sf-border)] rounded-lg px-3 py-1.5 bg-[var(--sf-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
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
          className="text-sm border border-[var(--sf-border)] rounded-lg px-3 py-1.5 bg-[var(--sf-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
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
          className="text-sm border border-[var(--sf-border)] rounded-lg px-3 py-1.5 bg-[var(--sf-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
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
          className="text-sm border border-[var(--sf-border)] rounded-lg px-3 py-1.5 bg-[var(--sf-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
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

        <span className="ml-auto text-sm text-[var(--sf-text-muted)] self-center">
          {pagination.total} creative{pagination.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Library grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-[var(--sf-bg-elevated)] rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--sf-border)] p-16 text-center">
          <p className="text-[var(--sf-text-secondary)] text-sm">
            No creatives yet. Upload your first batch above.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => setEditTemplate(t)}
                className="group relative bg-[var(--sf-bg-secondary)] rounded-xl overflow-hidden border border-[var(--sf-border)] hover:border-black cursor-pointer transition-colors"
              >
                {/* Image */}
                <div className="aspect-square bg-[var(--sf-bg-primary)] overflow-hidden">
                  <img
                    src={t.thumbnailUrl ?? t.sourceImageUrl}
                    alt={`${t.category} — ${t.type}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs font-medium px-2 py-1 rounded-lg">
                    Edit
                  </span>
                </div>

                {/* Tags */}
                <div className="p-2 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {badge(t.category)}
                    {badge(t.hookType)}
                  </div>
                  <p className="text-xs text-[var(--sf-text-secondary)] truncate">{t.type}</p>
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
                        onClick={(e) => { e.stopPropagation(); reAnalyze(t.id); }}
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
                className="px-3 py-1.5 text-sm border border-[var(--sf-border)] rounded-lg disabled:opacity-40 hover:bg-[var(--sf-bg-primary)]"
              >
                ← Prev
              </button>
              <span className="text-sm text-[var(--sf-text-secondary)]">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchLibrary(pagination.page + 1)}
                className="px-3 py-1.5 text-sm border border-[var(--sf-border)] rounded-lg disabled:opacity-40 hover:bg-[var(--sf-bg-primary)]"
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
