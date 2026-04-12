"use client";

// Inspiration Library — client component
// Features: responsive grid, filter sidebar, favorites, detail modal, URL state sync

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Palette } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TemplateCard {
  id: string;
  category: string;
  type: string;
  layout: string;
  hookType: string;
  palette: string[];
  language: string;
  thumbnailUrl: string | null;
  sourceImageUrl: string;
  uploadedAt: string;
  isFavorited: boolean;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ── Filter options (mirrors Prisma schema values) ──────────────────────────────
const CATEGORIES = [
  "skincare", "food", "fashion", "tech", "fitness",
  "home", "beauty", "health", "pet", "other",
];
const TYPES = [
  "product_hero", "before_after", "comparatif", "testimonial",
  "promo", "ugc_screenshot", "lifestyle", "data_stats", "listicle", "press_mention",
];
const HOOK_TYPES = [
  "pain", "curiosite", "social_proof", "fomo",
  "benefice_direct", "autorite", "urgence",
];
const LANGUAGES = ["fr", "en", "de", "other"];

const LANGUAGE_FLAGS: Record<string, string> = { fr: "🇫🇷", en: "🇬🇧", de: "🇩🇪", other: "🌐" };

function labelOf(val: string) {
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Favorite heart button ──────────────────────────────────────────────────────
function HeartButton({
  templateId,
  favorited,
  onToggle,
}: {
  templateId: string;
  favorited: boolean;
  onToggle: (id: string, next: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const next = !favorited;
    onToggle(templateId, next); // optimistic
    try {
      await fetch(`/api/library/favorites/${templateId}`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      onToggle(templateId, favorited); // revert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
        favorited
          ? "bg-red-500 text-white"
          : "bg-[var(--sf-bg-secondary)]/80 backdrop-blur text-[var(--sf-text-muted)] hover:text-red-400"
      }`}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        viewBox="0 0 24 24"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        className="w-4 h-4"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

// ── Template card ──────────────────────────────────────────────────────────────
function TemplateCardUI({
  template,
  onFavoriteToggle,
  onClick,
}: {
  template: TemplateCard;
  onFavoriteToggle: (id: string, next: boolean) => void;
  onClick: (t: TemplateCard) => void;
}) {
  const imgSrc = template.thumbnailUrl ?? template.sourceImageUrl;

  return (
    <div
      onClick={() => onClick(template)}
      className="relative group cursor-pointer rounded-2xl overflow-hidden border border-[var(--sf-border)] bg-[var(--sf-bg-primary)] hover:border-[var(--sf-border)] hover:shadow-md transition-all"
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-[var(--sf-bg-elevated)]">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={`${template.category} — ${template.type}`}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--sf-text-muted)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </div>
        )}
      </div>

      {/* Overlay badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
        <span className="px-2 py-0.5 bg-black/70 text-white text-xs rounded-full backdrop-blur">
          {labelOf(template.category)}
        </span>
      </div>
      <div className="absolute bottom-2 left-2 right-10 flex gap-1 flex-wrap">
        <span className="px-2 py-0.5 bg-[var(--sf-bg-secondary)]/80 backdrop-blur text-[var(--sf-text-primary)] text-xs rounded-full">
          {labelOf(template.hookType)}
        </span>
        <span className="text-xs px-1.5 py-0.5 bg-[var(--sf-bg-secondary)]/80 backdrop-blur rounded-full">
          {LANGUAGE_FLAGS[template.language] ?? "🌐"}
        </span>
      </div>

      {/* Favorite heart */}
      <HeartButton
        templateId={template.id}
        favorited={template.isFavorited}
        onToggle={onFavoriteToggle}
      />
    </div>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function DetailModal({
  template,
  onClose,
  onFavoriteToggle,
}: {
  template: TemplateCard;
  onClose: () => void;
  onFavoriteToggle: (id: string, next: boolean) => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--sf-bg-secondary)] rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative rounded-t-3xl overflow-hidden bg-[var(--sf-bg-elevated)] max-h-[55vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={template.sourceImageUrl}
            alt={`${template.category} — ${template.type}`}
            className="w-full h-full object-contain"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>

        {/* Metadata */}
        <div className="p-6 space-y-4">
          {/* Color palette */}
          {template.palette.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-[var(--sf-text-muted)]">Palette</span>
              {template.palette.map((hex, i) => (
                <div
                  key={i}
                  title={hex}
                  className="w-6 h-6 rounded-full border border-[var(--sf-border)]"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Category", value: template.category },
              { label: "Type", value: template.type },
              { label: "Hook", value: template.hookType },
              { label: "Layout", value: template.layout },
              { label: "Language", value: template.language },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--sf-bg-primary)] rounded-full border border-[var(--sf-border)]">
                <span className="text-xs text-[var(--sf-text-muted)]">{label}:</span>
                <span className="text-xs font-medium text-[var(--sf-text-primary)]">{labelOf(value)}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onFavoriteToggle(template.id, !template.isFavorited)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                template.isFavorited
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-[var(--sf-bg-elevated)] text-[var(--sf-text-primary)] hover:bg-[var(--sf-bg-elevated)]"
              }`}
            >
              {template.isFavorited ? "♥ Favorited" : "♡ Add to favorites"}
            </button>
            <a
              href={`/dashboard?inspiration=${template.id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Use as inspiration →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filter sidebar ─────────────────────────────────────────────────────────────
function FilterSidebar({
  active: { category, type, hookType, language, favoritesOnly },
  onSet,
  onReset,
  favoritesCount,
}: {
  active: { category: string; type: string; hookType: string; language: string; favoritesOnly: boolean };
  onSet: (key: string, value: string | boolean) => void;
  onReset: () => void;
  favoritesCount: number;
}) {
  const groups = [
    { key: "category", label: "Category", options: CATEGORIES },
    { key: "type", label: "Type", options: TYPES },
    { key: "hookType", label: "Hook", options: HOOK_TYPES },
    { key: "language", label: "Language", options: LANGUAGES },
  ] as const;

  const active: Record<string, string> = { category, type, hookType, language };
  const hasFilters = category || type || hookType || language || favoritesOnly;

  return (
    <aside className="w-56 flex-shrink-0 space-y-5">
      {/* Favorites toggle */}
      <div>
        <button
          type="button"
          onClick={() => onSet("favorites", !favoritesOnly)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            favoritesOnly
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-primary)] border-[var(--sf-border)] hover:border-[var(--sf-border)]"
          }`}
        >
          <span>♥ My Favorites</span>
          {favoritesCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
              {favoritesCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter groups */}
      {groups.map(({ key, label, options }) => (
        <div key={key} className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--sf-text-muted)] uppercase tracking-wide px-1">
            {label}
          </p>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSet(key, active[key] === opt ? "" : opt)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                active[key] === opt
                  ? "bg-black text-white"
                  : "text-[var(--sf-text-primary)] hover:bg-[var(--sf-bg-elevated)]"
              }`}
            >
              {labelOf(opt)}
            </button>
          ))}
        </div>
      ))}

      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="w-full px-3 py-2 text-sm text-[var(--sf-text-secondary)] hover:text-[var(--sf-text-primary)] border border-dashed border-[var(--sf-border)] rounded-xl transition-colors"
        >
          Reset filters
        </button>
      )}
    </aside>
  );
}

// ── Main client component ──────────────────────────────────────────────────────
export default function LibraryClient({
  initialFavoriteIds,
}: {
  initialFavoriteIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read filters from URL
  const category = searchParams.get("category") ?? "";
  const type = searchParams.get("type") ?? "";
  const hookType = searchParams.get("hookType") ?? "";
  const language = searchParams.get("language") ?? "";
  const favoritesOnly = searchParams.get("favorites") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // Data state
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    new Set(initialFavoriteIds)
  );

  // Modal
  const [modalTemplate, setModalTemplate] = useState<TemplateCard | null>(null);

  // Fetch templates whenever URL params change
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (type) qs.set("type", type);
      if (hookType) qs.set("hookType", hookType);
      if (language) qs.set("language", language);
      if (favoritesOnly) qs.set("favorites", "true");
      qs.set("page", String(page));

      const res = await fetch(`/api/library?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to load library");
      const data = await res.json();

      if (!isMounted.current) return;

      // Merge favoriteIds from server (full set) with local optimistic state
      setFavoriteIds(new Set(data.favoriteIds as string[]));

      // Attach isFavorited from merged set
      setTemplates(
        (data.templates as TemplateCard[]).map((t) => ({
          ...t,
          isFavorited: (data.favoriteIds as string[]).includes(t.id),
        }))
      );
      setPagination(data.pagination as Pagination);
    } catch (err) {
      if (isMounted.current) setError((err as Error).message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [category, type, hookType, language, favoritesOnly, page]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Update URL params
  const setFilter = (key: string, value: string | boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "favorites") {
      if (value) params.set("favorites", "true");
      else params.delete("favorites");
    } else {
      if (value) params.set(key, value as string);
      else params.delete(key);
    }
    params.delete("page"); // reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`);
  };

  const resetFilters = () => router.push(pathname);

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  // Optimistic favorite toggle (updates local state immediately)
  const handleFavoriteToggle = useCallback((id: string, next: boolean) => {
    setFavoriteIds((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isFavorited: next } : t))
    );
    setModalTemplate((prev) =>
      prev?.id === id ? { ...prev, isFavorited: next } : prev
    );
  }, []);

  return (
    <>
      {/* Modal */}
      {modalTemplate && (
        <DetailModal
          template={{ ...modalTemplate, isFavorited: favoriteIds.has(modalTemplate.id) }}
          onClose={() => setModalTemplate(null)}
          onFavoriteToggle={handleFavoriteToggle}
        />
      )}

      <div className="flex gap-8">
        {/* Sidebar */}
        <FilterSidebar
          active={{ category, type, hookType, language, favoritesOnly }}
          onSet={setFilter}
          onReset={resetFilters}
          favoritesCount={favoriteIds.size}
        />

        {/* Main grid area */}
        <div className="flex-1 min-w-0">
          {/* Stats bar */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-[var(--sf-text-secondary)]">
              {loading
                ? "Loading…"
                : pagination
                ? `${pagination.total.toLocaleString()} inspirations`
                : ""}
            </p>
            {pagination && pagination.pages > 1 && (
              <p className="text-sm text-[var(--sf-text-muted)]">
                Page {pagination.page} / {pagination.pages}
              </p>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-5">
              {error}
            </div>
          )}

          {loading ? (
            /* Skeleton grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-[var(--sf-bg-elevated)] rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="py-24 text-center">
              <Palette className="w-10 h-10 mx-auto mb-4 text-[var(--sf-text-muted)]" />
              <p className="text-lg font-semibold text-[var(--sf-text-primary)] mb-2">
                {favoritesOnly ? "No favorites yet" : "No inspirations found"}
              </p>
              <p className="text-sm text-[var(--sf-text-secondary)]">
                {favoritesOnly
                  ? "Heart any creative to save it here."
                  : "Try removing some filters or upload more creatives in the BDD Manager."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map((t) => (
                <TemplateCardUI
                  key={t.id}
                  template={{ ...t, isFavorited: favoriteIds.has(t.id) }}
                  onFavoriteToggle={handleFavoriteToggle}
                  onClick={setModalTemplate}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                type="button"
                onClick={() => setPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 text-sm font-medium border border-[var(--sf-border)] rounded-lg hover:border-[var(--sf-border)] disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-[var(--sf-text-secondary)] px-3">
                {pagination.page} / {pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => setPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-4 py-2 text-sm font-medium border border-[var(--sf-border)] rounded-lg hover:border-[var(--sf-border)] disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
