"use client";

// Brand DNA Enrichment UI — STA-80
// Restructured: Global Brand DNA tab + Products tab
// Drag-and-drop upload zones, font picker, section cleanup

import { useState, useRef, useEffect, useCallback } from "react";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { Persona, CommunicationAngles, BrandAsset, BrandProduct } from "@/types/index";

const PRICE_POSITIONS = ["budget", "mid-range", "premium", "ultra-premium"] as const;
const HOOK_OPTIONS = ["pain", "curiosite", "social_proof", "fomo", "benefice_direct", "autorite", "urgence"] as const;
const CAMPAIGN_OBJECTIVES = ["awareness", "consideration", "conversion", "retention"] as const;
const ASSET_TYPES = ["logo", "lifestyle", "icon", "pattern", "texture"] as const;

const POPULAR_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Source Sans Pro", "Raleway", "Nunito", "Playfair Display", "Merriweather",
  "PT Sans", "Ubuntu", "Noto Sans", "Oswald", "Roboto Condensed", "Roboto Slab",
  "Libre Baskerville", "Josefin Sans", "Cabin", "Quicksand", "Work Sans",
  "Fira Sans", "Titillium Web", "Exo 2", "Barlow", "Nunito Sans",
  "IBM Plex Sans", "DM Sans", "Outfit", "Plus Jakarta Sans", "Space Grotesk",
  "Manrope", "Cormorant Garamond", "EB Garamond", "Crimson Text", "Lora",
  "Source Serif Pro", "Vollkorn", "Arvo", "Bitter", "Zilla Slab",
  "Anton", "Bebas Neue", "Righteous", "Dancing Script", "Pacifico",
  "Sacramento", "Great Vibes",
] as const;

interface Props {
  brandId: string;
  initialDna: ExtractedBrandDNA;
  brandName: string;
}

// ── TagInput ──────────────────────────────────────────────────────────────────
function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput("");
  };
  const removeTag = (i: number) => onChange(tags.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--sf-text-primary)]">{label}</label>
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border border-[var(--sf-border)] rounded-lg bg-[var(--sf-bg-secondary)]">
        {tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--sf-bg-elevated)] rounded-full text-sm">
            {t}
            <button type="button" onClick={() => removeTag(i)} className="text-[var(--sf-text-muted)] hover:text-[var(--sf-text-secondary)] leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
        />
        <button type="button" onClick={addTag} className="px-3 py-2 text-sm bg-[var(--sf-bg-elevated)] rounded-lg font-medium transition-colors">
          Add
        </button>
      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--sf-text-primary)]">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--sf-text-secondary)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── PillSelect ────────────────────────────────────────────────────────────────
function PillSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
  max,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (selected: T[]) => void;
  max?: number;
}) {
  const toggle = (opt: T) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else if (!max || selected.length < max) onChange([...selected, opt]);
  };
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--sf-text-primary)]">{label}{max ? ` (max ${max})` : ""}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${selected.includes(opt) ? "bg-black text-white border-black" : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)]"}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── GroupHeader (legacy, kept for Products tab) ───────────────────────────────
function GroupHeader({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h2 className="text-lg font-bold text-[var(--sf-text-primary)]">{label}</h2>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--sf-accent-muted)", color: "var(--sf-accent)" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── CollapsibleSection ────────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--sf-border)] rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-[var(--sf-bg-secondary)] hover:bg-[var(--sf-bg-elevated)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[var(--sf-text-primary)]">{title}</h2>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--sf-accent-muted)", color: "var(--sf-accent)" }}>
              {badge}
            </span>
          )}
        </div>
        <span className="text-[var(--sf-text-muted)] text-sm ml-4">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-6 py-6 space-y-6 bg-[var(--sf-bg-primary)]">
          {children}
        </div>
      )}
    </div>
  );
}

// ── BrandAssetManager ─────────────────────────────────────────────────────────
// Unified typed brand asset library (Phase E): logo | lifestyle | icon | pattern | texture
// Logo is a mandatory single-slot section; all other types are in "Additional Brand Assets".
function BrandAssetManager({
  brandId,
  assets,
  onChange,
}: {
  brandId: string;
  assets: BrandAsset[];
  onChange: (assets: BrandAsset[]) => void;
}) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [uploadingOther, setUploadingOther] = useState(false);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [pendingType, setPendingType] = useState<typeof ASSET_TYPES[number]>("lifestyle");
  const [otherDragOver, setOtherDragOver] = useState(false);
  const otherInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "other");
    const res = await fetch(`/api/brands/${brandId}/assets`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return data.asset.url as string;
  }, [brandId]);

  const logoAsset = assets.find((a) => a.type === "logo") ?? null;
  const otherAssets = assets.filter((a) => a.type !== "logo");

  const handleLogoFile = async (file: File) => {
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const url = await uploadFile(file);
      const newLogo: BrandAsset = { id: crypto.randomUUID(), type: "logo", url };
      // Replace any existing logo, keep all other assets
      onChange([newLogo, ...assets.filter((a) => a.type !== "logo")]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      console.error("[BrandAssetManager] logo upload error:", err);
      setLogoError(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => onChange(assets.filter((a) => a.type !== "logo"));

  const handleOtherFiles = async (files: File[]) => {
    setUploadingOther(true);
    setOtherError(null);
    try {
      // Accumulate into a local variable to avoid stale closure when uploading multiple files
      let accumulated = [...assets];
      for (const file of files) {
        const url = await uploadFile(file);
        accumulated = [...accumulated, { id: crypto.randomUUID(), type: pendingType, url }];
      }
      onChange(accumulated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      console.error("[BrandAssetManager] upload error:", err);
      setOtherError(message);
    } finally {
      setUploadingOther(false);
    }
  };

  const addUrl = () => {
    const val = urlInput.trim();
    if (!val) return;
    onChange([...assets, { id: crypto.randomUUID(), type: pendingType, url: val }]);
    setUrlInput("");
  };

  const updateType = (id: string, type: typeof ASSET_TYPES[number]) =>
    onChange(assets.map((a) => (a.id === id ? { ...a, type } : a)));

  const removeAsset = (id: string) => onChange(assets.filter((a) => a.id !== id));

  return (
    <div className="space-y-6">
      {/* ── Brand Logo (required) ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--sf-text-primary)]">Brand Logo</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">required</span>
        </div>
        <p className="text-xs text-[var(--sf-text-muted)]">Used in every generated creative. PNG or SVG with transparent background preferred.</p>

        {logoAsset ? (
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-[var(--sf-accent)] bg-[var(--sf-bg-elevated)] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoAsset.url} alt="Brand logo" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] hover:bg-[var(--sf-bg-elevated)] transition-colors"
              >
                Replace logo
              </button>
              <button
                type="button"
                onClick={removeLogo}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true); }}
            onDragLeave={() => setLogoDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setLogoDragOver(false);
              const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
              if (file) await handleLogoFile(file);
            }}
            onClick={() => logoInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              logoDragOver ? "border-[var(--sf-accent)] bg-[var(--sf-bg-elevated)]" : "border-red-300 hover:border-[var(--sf-accent)] bg-red-50/30"
            }`}
          >
            {uploadingLogo ? (
              <p className="text-sm text-[var(--sf-text-secondary)]">Uploading…</p>
            ) : (
              <p className="text-sm text-[var(--sf-text-secondary)]">
                Drag & drop or <span className="underline font-medium">click to upload logo</span>
                <span className="ml-2 text-xs text-[var(--sf-text-muted)]">PNG, JPEG, WebP — max 10 MB</span>
              </p>
            )}
          </div>
        )}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await handleLogoFile(file);
            e.target.value = "";
          }}
        />
        {logoError && <p className="text-sm text-red-500">{logoError}</p>}
      </div>

      {/* ── Additional Brand Assets ───────────────────────────────────────── */}
      <div className="space-y-3">
        <span className="text-sm font-semibold text-[var(--sf-text-primary)]">Additional Brand Assets</span>
        <p className="text-xs text-[var(--sf-text-muted)]">Lifestyle photos, icons, patterns, textures — tagged and used in generation.</p>

        {/* Type selector for new uploads */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--sf-text-secondary)]">Add as:</span>
          <div className="flex flex-wrap gap-1.5">
            {(ASSET_TYPES.filter((t) => t !== "logo") as Array<typeof ASSET_TYPES[number]>).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPendingType(t)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors capitalize ${
                  pendingType === t
                    ? "bg-black text-white border-black"
                    : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setOtherDragOver(true); }}
          onDragLeave={() => setOtherDragOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setOtherDragOver(false);
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
            if (files.length > 0) await handleOtherFiles(files);
          }}
          onClick={() => otherInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            otherDragOver ? "border-[var(--sf-accent)] bg-[var(--sf-bg-elevated)]" : "border-[var(--sf-border)] hover:border-[var(--sf-text-muted)]"
          }`}
        >
          {uploadingOther ? (
            <p className="text-sm text-[var(--sf-text-secondary)]">Uploading…</p>
          ) : (
            <p className="text-sm text-[var(--sf-text-secondary)]">
              Drag & drop or <span className="underline font-medium">click to upload</span>
              <span className="ml-2 text-xs text-[var(--sf-text-muted)]">PNG, JPEG, WebP — max 10 MB</span>
            </p>
          )}
        </div>
        <input
          ref={otherInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) await handleOtherFiles(files);
            e.target.value = "";
          }}
        />

        {/* URL input */}
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
            placeholder="Or paste image URL…"
            className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
          />
          <button type="button" onClick={addUrl} className="px-3 py-2 text-sm bg-[var(--sf-bg-elevated)] rounded-lg font-medium whitespace-nowrap">
            Add URL
          </button>
        </div>

        {otherError && <p className="text-sm text-red-500">{otherError}</p>}

        {/* Asset grid — non-logo assets only */}
        {otherAssets.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {otherAssets.map((asset) => (
              <div key={asset.id} className="relative group space-y-1">
                <div className="relative rounded-xl overflow-hidden aspect-square bg-[var(--sf-bg-elevated)] border border-[var(--sf-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                  <button
                    type="button"
                    onClick={() => removeAsset(asset.id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
                {/* Type selector per asset */}
                <select
                  value={asset.type}
                  onChange={(e) => updateType(asset.id, e.target.value as typeof ASSET_TYPES[number])}
                  className="w-full text-xs border border-[var(--sf-border)] rounded-md px-1 py-0.5 bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] focus:outline-none"
                >
                  {ASSET_TYPES.filter((t) => t !== "logo").map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DropZone ──────────────────────────────────────────────────────────────────
// Handles drag-and-drop / click-to-upload image upload + optional URL input.
function DropZone({
  brandId,
  urls,
  onUrlsChange,
  multiple = true,
  showUrlInput = false,
  label,
}: {
  brandId: string;
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
  multiple?: boolean;
  showUrlInput?: boolean;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File, currentUrls: string[]) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "other");
    const res = await fetch(`/api/brands/${brandId}/assets`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return data.asset.url as string;
  }, [brandId]);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    setError(null);
    try {
      const toUpload = multiple ? files : [files[0]];
      let updated = [...urls];
      for (const file of toUpload) {
        if (!file) continue;
        const newUrl = await uploadFile(file, updated);
        updated = multiple ? [...updated, newUrl] : [newUrl];
      }
      onUrlsChange(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addUrl = () => {
    const val = urlInput.trim();
    if (!val) return;
    onUrlsChange(multiple ? (urls.includes(val) ? urls : [...urls, val]) : [val]);
    setUrlInput("");
  };

  const removeUrl = (i: number) => onUrlsChange(urls.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium text-[var(--sf-text-primary)]">{label}</label>}

      {/* Image grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-[var(--sf-bg-elevated)] border border-[var(--sf-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
              <button
                type="button"
                onClick={() => removeUrl(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop area (always shown for multi, shown for single only when empty) */}
      {(multiple || urls.length === 0) && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragOver(false);
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
            if (files.length > 0) await handleFiles(files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver ? "border-[var(--sf-accent)] bg-[var(--sf-bg-elevated)]" : "border-[var(--sf-border)] hover:border-[var(--sf-text-muted)]"
          }`}
        >
          {uploading ? (
            <p className="text-sm text-[var(--sf-text-secondary)]">Uploading…</p>
          ) : (
            <>
              <p className="text-sm text-[var(--sf-text-secondary)]">Drag & drop or <span className="underline font-medium">click to upload</span></p>
              <p className="text-xs text-[var(--sf-text-muted)] mt-1">PNG, JPEG, WebP — max 10 MB</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) await handleFiles(files);
          e.target.value = "";
        }}
      />

      {/* Optional URL input (Re-fetch from URL) */}
      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
            placeholder="Or paste image URL…"
            className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
          />
          <button type="button" onClick={addUrl} className="px-3 py-2 text-sm bg-[var(--sf-bg-elevated)] rounded-lg font-medium transition-colors whitespace-nowrap">
            Add URL
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ── FontPicker ────────────────────────────────────────────────────────────────
// Searchable dropdown with Google Fonts live preview.
function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = (POPULAR_FONTS as readonly string[]).filter((f) =>
    f.toLowerCase().includes(query.toLowerCase())
  );

  const loadFont = (font: string) => {
    const id = `gf-${font.replace(/\s+/g, "-")}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400&display=swap`;
      document.head.appendChild(link);
    }
  };

  // Load selected font for preview
  useEffect(() => { if (value) loadFont(value); }, [value]);

  // Lazy-load first batch when dropdown opens
  useEffect(() => {
    if (!open) return;
    filtered.slice(0, 20).forEach(loadFont);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 px-3 py-2.5 border border-[var(--sf-border)] rounded-lg bg-[var(--sf-bg-secondary)] cursor-pointer hover:border-[var(--sf-text-muted)] transition-colors"
      >
        {value ? (
          <span style={{ fontFamily: `"${value}", sans-serif` }} className="flex-1 text-sm text-[var(--sf-text-primary)]">
            {value} — The quick brown fox
          </span>
        ) : (
          <span className="flex-1 text-sm text-[var(--sf-text-muted)]">Select a font…</span>
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="text-[var(--sf-text-muted)] hover:text-[var(--sf-text-secondary)] text-sm leading-none mr-1"
          >
            ×
          </button>
        )}
        <span className="text-[var(--sf-text-muted)] text-xs">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-[var(--sf-bg-secondary)] border border-[var(--sf-border)] rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--sf-border)]">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fonts…"
              className="w-full px-3 py-1.5 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[var(--sf-text-muted)]">No fonts found</p>
            ) : (
              filtered.map((font) => (
                <button
                  key={font}
                  type="button"
                  onMouseEnter={() => loadFont(font)}
                  onClick={() => { onChange(font); setOpen(false); setQuery(""); }}
                  className={`w-full px-4 py-2.5 text-left transition-colors hover:bg-[var(--sf-bg-elevated)] ${value === font ? "bg-[var(--sf-bg-elevated)]" : ""}`}
                >
                  <span className="text-xs text-[var(--sf-text-muted)] block mb-0.5">{font}</span>
                  <span style={{ fontFamily: `"${font}", sans-serif` }} className="text-sm text-[var(--sf-text-primary)]">
                    The quick brown fox jumps over the lazy dog
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────
function ProductCard({
  product,
  index,
  brandId,
  onUpdate,
  onRemove,
}: {
  product: BrandProduct;
  index: number;
  brandId: string;
  onUpdate: (patch: Partial<BrandProduct>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [extractUrl, setExtractUrl] = useState(product.sourceUrl ?? "");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState(!!product.sourceUrl && !!product.name);

  async function handleExtract() {
    const url = extractUrl.trim();
    if (!url) return;
    setExtracting(true);
    setExtractError(null);
    setExtracted(false);
    try {
      const res = await fetch(`/api/brands/${brandId}/products/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json();
        setExtractError(err.message ?? "Extraction failed. Fill in the details manually.");
        return;
      }
      const { extraction } = await res.json();
      const patch: Partial<BrandProduct> = { sourceUrl: url };
      if (!product.name && extraction.name) patch.name = extraction.name;
      if (!product.description && (extraction.description || extraction.tagline))
        patch.description = extraction.description ?? extraction.tagline ?? "";
      if (product.images.length === 0 && extraction.productImages?.length > 0)
        patch.images = extraction.productImages.slice(0, 8);
      onUpdate(patch);
      setExtracted(true);
    } catch {
      setExtractError("Network error. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="border border-[var(--sf-border)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-[var(--sf-bg-secondary)]">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-3 flex-1 text-left min-w-0">
          <span className="w-6 h-6 rounded-full bg-[var(--sf-bg-elevated)] text-xs font-semibold flex-shrink-0 flex items-center justify-center text-[var(--sf-text-secondary)]">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-[var(--sf-text-primary)] truncate">
            {product.name || `Product ${index + 1}`}
          </span>
          <span className="text-xs text-[var(--sf-text-muted)] flex-shrink-0 ml-auto mr-3">{expanded ? "▲" : "▼"}</span>
        </button>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
          Remove
        </button>
      </div>

      {expanded && (
        <div className="p-5 space-y-6 border-t border-[var(--sf-border)] bg-[var(--sf-bg-primary)]">

          {/* URL-first extraction — primary path */}
          <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] p-4">
            <p className="text-xs font-semibold text-[var(--sf-text-primary)] mb-1 uppercase tracking-wide">
              Product page URL
            </p>
            <p className="text-xs text-[var(--sf-text-muted)] mb-3">
              Paste the URL of your product page — name, description, and images will be extracted automatically.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={extractUrl}
                onChange={(e) => { setExtractUrl(e.target.value); setExtracted(false); setExtractError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleExtract(); } }}
                placeholder="https://yourstore.com/products/serum"
                className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
              />
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting || !extractUrl.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--sf-accent)] text-white hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              >
                {extracting ? "Extracting…" : "Extract →"}
              </button>
            </div>
            {extracting && (
              <p className="mt-2 text-xs text-[var(--sf-text-muted)] animate-pulse">
                Analyzing with Claude… usually 15–30 seconds
              </p>
            )}
            {extractError && (
              <p className="mt-2 text-xs text-red-400">{extractError}</p>
            )}
            {extracted && !extracting && (
              <p className="mt-2 text-xs text-emerald-400">✓ Product data extracted — review and adjust below</p>
            )}
            <p className="mt-3 text-xs text-[var(--sf-text-muted)]">or fill in the details manually below</p>
          </div>

          {/* Manual fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--sf-text-secondary)] mb-1">Product name</label>
              <input
                type="text"
                value={product.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g. Vitamin C Serum"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sf-text-secondary)] mb-1">Description</label>
              <input
                type="text"
                value={product.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Short product description…"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--sf-text-primary)] mb-1">Product Images</p>
            <p className="text-xs text-[var(--sf-text-secondary)] mb-3">Packshots and product photos for this product.</p>
            <DropZone brandId={brandId} urls={product.images} onUrlsChange={(images) => onUpdate({ images })} multiple showUrlInput />
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--sf-text-primary)] mb-1">Icons & UI Elements</p>
            <p className="text-xs text-[var(--sf-text-secondary)] mb-3">Icons, badges, and UI assets specific to this product.</p>
            <DropZone brandId={brandId} urls={product.icons} onUrlsChange={(icons) => onUpdate({ icons })} multiple showUrlInput />
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--sf-text-primary)] mb-1">Moodboard</p>
            <p className="text-xs text-[var(--sf-text-secondary)] mb-3">Reference images for the visual direction of this product's ads.</p>
            <DropZone brandId={brandId} urls={product.moodboard} onUrlsChange={(moodboard) => onUpdate({ moodboard })} multiple />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BrandDnaClient({ brandId, initialDna, brandName }: Props) {
  const [dna, setDna] = useState<ExtractedBrandDNA>(initialDna);
  const [activeTab, setActiveTab] = useState<"global" | "products">("global");

  // ── Save state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Visual Identity ──────────────────────────────────────────────────────────
  const [colors, setColors] = useState(dna.colors);
  const [font, setFont] = useState<string>((dna.fonts ?? [])[0] ?? "");
  // Phase E: unified brand asset library. Seed from existing logoUrl/lifestyleImages if brandAssets is empty.
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>(() => {
    if ((dna.brandAssets ?? []).length > 0) return dna.brandAssets!;
    const seeded: BrandAsset[] = [];
    if (dna.logoUrl) seeded.push({ id: crypto.randomUUID(), type: "logo", url: dna.logoUrl });
    for (const url of (dna.lifestyleImages ?? [])) {
      seeded.push({ id: crypto.randomUUID(), type: "lifestyle", url });
    }
    return seeded;
  });

  // ── Strategy ─────────────────────────────────────────────────────────────────
  const [pricePositioning, setPricePositioning] = useState<typeof PRICE_POSITIONS[number] | "">(
    (dna.pricePositioning as typeof PRICE_POSITIONS[number]) ?? ""
  );
  const [targetMarkets, setTargetMarkets] = useState<string[]>(dna.targetMarkets ?? []);
  const [differentiators, setDifferentiators] = useState<string[]>(dna.differentiators ?? []);
  const [productCategory, setProductCategory] = useState(dna.productCategory ?? "");
  const [keyBenefits, setKeyBenefits] = useState<string[]>(dna.keyBenefits ?? []);

  // ── Voice & Messaging ───────────────────────────────────────────────────────
  const [toneOfVoice, setToneOfVoice] = useState(dna.toneOfVoice ?? "");
  const [brandVoice, setBrandVoice] = useState(dna.brandVoice ?? "");
  const [brandVoiceAdjectives, setBrandVoiceAdjectives] = useState<string[]>(dna.brandVoiceAdjectives ?? []);
  const [forbiddenWords, setForbiddenWords] = useState<string[]>(dna.forbiddenWords ?? []);
  const [mandatoryMentions, setMandatoryMentions] = useState<string[]>(dna.mandatoryMentions ?? []);
  const [requiredWording, setRequiredWording] = useState<string[]>(dna.requiredWording ?? []);
  const [messagingHierarchy, setMessagingHierarchy] = useState<string[]>(dna.messagingHierarchy ?? []);
  const [callToActionExamples, setCallToActionExamples] = useState<string[]>(dna.callToActionExamples ?? []);

  // ── Creative Direction ──────────────────────────────────────────────────────
  const [visualStyleKeywords, setVisualStyleKeywords] = useState<string[]>(dna.visualStyleKeywords ?? []);
  const [creativeDoList, setCreativeDoList] = useState<string[]>(dna.creativeDoList ?? []);
  const [creativeDontList, setCreativeDontList] = useState<string[]>(dna.creativeDontList ?? []);
  const [preferredHooks, setPreferredHooks] = useState<Array<typeof HOOK_OPTIONS[number]>>(
    (dna.preferredHooks ?? []) as Array<typeof HOOK_OPTIONS[number]>
  );
  const [avoidedHooks, setAvoidedHooks] = useState<string[]>(dna.avoidedHooks ?? []);

  // ── Customer Intelligence ───────────────────────────────────────────────────
  const [customerReviewsVerbatim, setCustomerReviewsVerbatim] = useState<string[]>(dna.customerReviewsVerbatim ?? []);
  const [customerPainPoints, setCustomerPainPoints] = useState<string[]>(dna.customerPainPoints ?? []);
  const [customerDesiredOutcome, setCustomerDesiredOutcome] = useState(dna.customerDesiredOutcome ?? "");
  const [customerObjections, setCustomerObjections] = useState<string[]>(dna.customerObjections ?? []);
  const [reviewsUrl, setReviewsUrl] = useState(dna.reviewsUrl ?? "");
  const [extractingReviews, setExtractingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // ── Campaign Context ────────────────────────────────────────────────────────
  const [currentCampaignObjective, setCurrentCampaignObjective] = useState<typeof CAMPAIGN_OBJECTIVES[number] | "">(
    (dna.currentCampaignObjective as typeof CAMPAIGN_OBJECTIVES[number]) ?? ""
  );
  const [currentPromotion, setCurrentPromotion] = useState(dna.currentPromotion ?? "");
  const [seasonalConstraints, setSeasonalConstraints] = useState<string[]>(dna.seasonalConstraints ?? []);
  const [legalConstraints, setLegalConstraints] = useState<string[]>(dna.legalConstraints ?? []);
  // campaignOpen removed — Campaign Context is now a CollapsibleSection (Phase E)

  // ── Brand Charter ───────────────────────────────────────────────────────────
  const [brandBrief, setBrandBrief] = useState(dna.brandBrief ?? "");
  const [structuredPersonas, setStructuredPersonas] = useState<Persona[]>(dna.structuredPersonas ?? []);
  const [preferredAngles, setPreferredAngles] = useState<string[]>(dna.communicationAngles?.preferred ?? []);
  const [forbiddenAngles, setForbiddenAngles] = useState<string[]>(dna.communicationAngles?.forbidden ?? []);

  // ── Products ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<BrandProduct[]>(dna.products ?? []);

  // ── Persona helpers ─────────────────────────────────────────────────────────
  const addPersona = () => setStructuredPersonas((prev) => [...prev, { name: "", ageRange: "", painPoints: [], aspirations: [], description: "" }]);
  const updatePersona = (i: number, patch: Partial<Persona>) => setStructuredPersonas((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const removePersona = (i: number) => setStructuredPersonas((prev) => prev.filter((_, idx) => idx !== i));

  // ── Product helpers ─────────────────────────────────────────────────────────
  const addProduct = () => setProducts((prev) => [...prev, { id: crypto.randomUUID(), sourceUrl: "", name: "", description: "", images: [], icons: [], moodboard: [] }]);
  const updateProduct = (i: number, patch: Partial<BrandProduct>) => setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const removeProduct = (i: number) => setProducts((prev) => prev.filter((_, idx) => idx !== i));

  // ── Save all ────────────────────────────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/enrich`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colors,
          fonts: font ? [font] : [],
          // Derive backward-compat fields from brandAssets
          logoUrl: brandAssets.find((a) => a.type === "logo")?.url ?? null,
          lifestyleImages: brandAssets.filter((a) => a.type === "lifestyle").map((a) => a.url),
          brandAssets,
          pricePositioning: pricePositioning || undefined,
          targetMarkets,
          differentiators,
          productCategory,
          keyBenefits,
          toneOfVoice,
          brandVoice,
          brandVoiceAdjectives,
          forbiddenWords,
          mandatoryMentions,
          requiredWording,
          messagingHierarchy,
          callToActionExamples,
          visualStyleKeywords,
          creativeDoList,
          creativeDontList,
          preferredHooks,
          avoidedHooks,
          customerReviewsVerbatim,
          customerPainPoints,
          customerDesiredOutcome: customerDesiredOutcome || undefined,
          customerObjections,
          currentCampaignObjective: currentCampaignObjective || undefined,
          currentPromotion: currentPromotion || undefined,
          seasonalConstraints,
          legalConstraints,
          brandBrief,
          structuredPersonas,
          communicationAngles: { preferred: preferredAngles, forbidden: forbiddenAngles } as CommunicationAngles,
          products,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Extract customer vocabulary ─────────────────────────────────────────────
  const extractReviews = async () => {
    if (!reviewsUrl.trim()) return;
    setExtractingReviews(true);
    setReviewsError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewsUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setDna((prev) => ({ ...prev, reviewsUrl, customerVocabulary: data.customerVocabulary }));
    } catch (err) {
      setReviewsError((err as Error).message);
    } finally {
      setExtractingReviews(false);
    }
  };

  const SaveButton = () => (
    <button type="button" onClick={saveAll} disabled={saving}
      className="px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
      {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-[var(--sf-text-secondary)] mb-1">
            <a href="/dashboard" className="hover:underline">Dashboard</a> / Brand DNA
          </p>
          <h1 className="text-2xl font-bold text-[var(--sf-text-primary)]">{brandName}</h1>
        </div>
        <SaveButton />
      </div>

      {saveError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{saveError}</div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-[var(--sf-bg-secondary)] rounded-xl border border-[var(--sf-border)] w-fit mb-8">
        {(["global", "products"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? "bg-[var(--sf-bg-primary)] text-[var(--sf-text-primary)] shadow-sm"
                : "text-[var(--sf-text-secondary)] hover:text-[var(--sf-text-primary)]"
            }`}
          >
            {tab === "global" ? "Global Brand DNA" : `Products${products.length > 0 ? ` (${products.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Global Brand DNA — 5 collapsible sections (Phase E)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "global" && (
        <div className="space-y-4">

          {/* SECTION 1 — Visual Identity */}
          <CollapsibleSection title="Visual Identity" badge="Auto-extracted · Editable">
            <Section title="Brand Colors" subtitle="Edit directly — applied to all future creatives.">
              <div className="space-y-3">
                {(["primary", "secondary", "accent"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="w-24 text-sm font-medium text-[var(--sf-text-primary)] capitalize">{key}</label>
                    <input type="color" value={colors[key]} onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-[var(--sf-border)] cursor-pointer p-0.5 bg-[var(--sf-bg-secondary)]" />
                    <input type="text" value={colors[key]}
                      onChange={(e) => { const val = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setColors((prev) => ({ ...prev, [key]: val })); }}
                      className="w-28 px-3 py-2 text-sm font-mono border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
                      placeholder="#000000" maxLength={7} />
                    <div className="flex-1 h-8 rounded-lg border border-[var(--sf-border)]" style={{ backgroundColor: colors[key] }} />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Brand Font" subtitle="Primary typeface. Used for guidance in ad generation prompts.">
              <FontPicker value={font} onChange={setFont} />
            </Section>

            <Section title="Brand Assets" subtitle="Logo, lifestyle photos, icons, patterns, textures — tagged and used in generation.">
              <BrandAssetManager brandId={brandId} assets={brandAssets} onChange={setBrandAssets} />
            </Section>
          </CollapsibleSection>

          {/* SECTION 2 — Brand Voice */}
          <CollapsibleSection title="Brand Voice">
            <Section title="Tone of Voice" subtitle="How the brand communicates. Injected into every creative brief.">
              <textarea value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} rows={3}
                placeholder="Casual and warm, uses tutoiement, emphasis on community and authenticity…"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none" />
            </Section>

            <Section title="Brand Voice" subtitle="What makes this brand's communication unique.">
              <textarea value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} rows={3}
                placeholder="2-3 sentences describing what makes this brand's voice unique…"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none" />
            </Section>

            <Section title="Voice Adjectives" subtitle="Up to 6 adjectives that define the brand voice.">
              <TagInput label="Adjectives (max 6)" tags={brandVoiceAdjectives} onChange={(tags) => setBrandVoiceAdjectives(tags.slice(0, 6))} placeholder="e.g. bold, warm, direct…" />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Forbidden Words" subtitle="Claude will never use these words.">
                <TagInput label="Never say" tags={forbiddenWords} onChange={setForbiddenWords} placeholder="e.g. cheap, diet, anti-aging…" />
              </Section>
              <Section title="Mandatory Mentions" subtitle="Must always be included.">
                <TagInput label="Always include" tags={mandatoryMentions} onChange={setMandatoryMentions} placeholder="e.g. dermatologist-tested…" />
              </Section>
            </div>

            <Section title="Required Wording" subtitle="Exact phrases required by brand or legal guidelines.">
              <TagInput label="Required phrases" tags={requiredWording} onChange={setRequiredWording} placeholder="e.g. 100% natural ingredients…" />
            </Section>

            <Section title="Messaging Hierarchy" subtitle="Ordered from most to least important.">
              <TagInput label="Messages (ordered)" tags={messagingHierarchy} onChange={setMessagingHierarchy} placeholder="e.g. Primary: transform your routine…" />
            </Section>

            <Section title="Call-to-Action Examples" subtitle="CTAs that fit this brand's tone.">
              <TagInput label="CTA examples" tags={callToActionExamples} onChange={setCallToActionExamples} placeholder="e.g. Shop the collection, Discover now…" />
            </Section>

            <Section title="Brand Brief" subtitle="Free text: who you are, who you're not, your obsession.">
              <textarea value={brandBrief} onChange={(e) => setBrandBrief(e.target.value)} rows={4}
                placeholder="We want to be perceived as X. Our brand is never Y. Our obsession is Z…"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none" />
            </Section>

            <Section title="Communication Angles" subtitle="Preferred and forbidden communication approaches.">
              <TagInput label="Preferred angles" tags={preferredAngles} onChange={setPreferredAngles} placeholder="e.g. transformation, authenticity, expertise…" />
              <TagInput label="Forbidden angles" tags={forbiddenAngles} onChange={setForbiddenAngles} placeholder="e.g. fear-based, aggressive discounts…" />
            </Section>
          </CollapsibleSection>

          {/* SECTION 3 — Audience */}
          <CollapsibleSection title="Audience">
            <Section title="Target Markets" subtitle="Countries or regions this brand targets.">
              <TagInput label="Markets" tags={targetMarkets} onChange={setTargetMarkets} placeholder="e.g. France, US, Europe…" />
            </Section>

            <Section title="Buyer Personas" subtitle="Detailed personas with pain points and aspirations.">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--sf-text-primary)]">Personas</label>
                  <button type="button" onClick={addPersona} className="text-xs px-3 py-1.5 bg-[var(--sf-bg-elevated)] rounded-lg font-medium transition-colors">
                    + Add persona
                  </button>
                </div>
                {structuredPersonas.map((p, i) => (
                  <div key={i} className="border border-[var(--sf-border)] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--sf-text-primary)]">Persona {i + 1}</p>
                      <button type="button" onClick={() => removePersona(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--sf-text-secondary)] mb-1">Name</label>
                        <input type="text" value={p.name} onChange={(e) => updatePersona(i, { name: e.target.value })} placeholder="e.g. Sarah"
                          className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--sf-text-secondary)] mb-1">Age range</label>
                        <input type="text" value={p.ageRange} onChange={(e) => updatePersona(i, { ageRange: e.target.value })} placeholder="e.g. 28-40"
                          className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--sf-text-secondary)] mb-1">Description</label>
                      <textarea value={p.description} onChange={(e) => updatePersona(i, { description: e.target.value })} rows={2}
                        placeholder="Who is this person? Lifestyle, habits, values…"
                        className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none" />
                    </div>
                    <TagInput label="Pain points" tags={p.painPoints} onChange={(tags) => updatePersona(i, { painPoints: tags })} placeholder="e.g. feels invisible, dry skin…" />
                    <TagInput label="Aspirations" tags={p.aspirations} onChange={(tags) => updatePersona(i, { aspirations: tags })} placeholder="e.g. feel confident, look effortless…" />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Customer Reviews Verbatim" subtitle="Real customer quotes — max 10. Used directly in ad copy.">
              <TagInput label="Verbatim quotes (max 10)" tags={customerReviewsVerbatim} onChange={(tags) => setCustomerReviewsVerbatim(tags.slice(0, 10))} placeholder="Exact customer quote…" />
            </Section>

            <Section title="Customer Pain Points">
              <TagInput label="Pain points" tags={customerPainPoints} onChange={setCustomerPainPoints} placeholder="e.g. struggled to find ethical alternatives…" />
            </Section>

            <Section title="Customer Desired Outcome" subtitle="The single most important outcome customers want.">
              <input type="text" value={customerDesiredOutcome} onChange={(e) => setCustomerDesiredOutcome(e.target.value)}
                placeholder="e.g. feel confident and put-together without effort…"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
            </Section>

            <Section title="Customer Objections" subtitle="Reasons someone might hesitate to buy.">
              <TagInput label="Objections" tags={customerObjections} onChange={setCustomerObjections} placeholder="e.g. too expensive, not sure if it works…" />
            </Section>

            <Section title="Extract from Reviews Page" subtitle="Paste a Trustpilot or reviews page URL — Claude extracts the real vocabulary your customers use.">
              <div className="flex gap-2">
                <input type="url" value={reviewsUrl} onChange={(e) => setReviewsUrl(e.target.value)}
                  placeholder="https://www.trustpilot.com/review/yourbrand.com"
                  className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
                <button type="button" onClick={extractReviews} disabled={extractingReviews || !reviewsUrl.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                  style={{ background: "var(--sf-accent)" }}>
                  {extractingReviews ? "Extracting…" : "Extract with Claude"}
                </button>
              </div>
              {reviewsError && <p className="text-sm text-red-500">{reviewsError}</p>}
              {dna.customerVocabulary && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-[var(--sf-text-primary)]">Extracted vocabulary</p>
                  <ul className="space-y-1">
                    {dna.customerVocabulary.verbatims.slice(0, 5).map((v, i) => (
                      <li key={i} className="text-sm italic border-l-2 pl-3 text-[var(--sf-text-primary)]" style={{ borderColor: "var(--sf-accent-muted)" }}>
                        &ldquo;{v}&rdquo;
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    {dna.customerVocabulary.emotionalWords.map((w, i) => (
                      <span key={i} className="px-2.5 py-1 text-xs rounded-full" style={{ background: "var(--sf-accent-muted)", color: "var(--sf-accent)" }}>{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </CollapsibleSection>

          {/* SECTION 4 — Strategy */}
          <CollapsibleSection title="Strategy">
            <Section title="Price Positioning" subtitle="Where this brand sits in the market.">
              <div className="flex flex-wrap gap-2">
                {PRICE_POSITIONS.map((pos) => (
                  <button key={pos} type="button" onClick={() => setPricePositioning(pricePositioning === pos ? "" : pos)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors capitalize ${pricePositioning === pos ? "bg-black text-white border-black" : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)]"}`}>
                    {pos}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Product Category">
              <input type="text" value={productCategory} onChange={(e) => setProductCategory(e.target.value)}
                placeholder="e.g. skincare, fashion, food…"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
            </Section>

            <Section title="Key Benefits" subtitle="Core product benefits used in ad copy.">
              <TagInput label="Benefits" tags={keyBenefits} onChange={setKeyBenefits} placeholder="e.g. 100% natural, dermatologist-tested…" />
            </Section>

            <Section title="Differentiators" subtitle="What makes this brand unique vs. competitors.">
              <TagInput label="Differentiators" tags={differentiators} onChange={setDifferentiators} placeholder="e.g. ethically sourced, made in France…" />
            </Section>

            <Section title="Visual Style Keywords" subtitle="Keywords describing the brand's visual aesthetic.">
              <TagInput label="Style keywords" tags={visualStyleKeywords} onChange={setVisualStyleKeywords} placeholder="e.g. minimalist, editorial, raw UGC, luxury…" />
            </Section>

            <Section title="Creative Do's & Don'ts">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TagInput label="✓ Do's" tags={creativeDoList} onChange={setCreativeDoList} placeholder="e.g. use natural lighting…" />
                <TagInput label="✗ Don'ts" tags={creativeDontList} onChange={setCreativeDontList} placeholder="e.g. avoid stock photo feel…" />
              </div>
            </Section>

            <Section title="Ad Hooks" subtitle="Hook types to use or avoid in creative briefs.">
              <PillSelect label="Preferred hooks" options={HOOK_OPTIONS} selected={preferredHooks} onChange={setPreferredHooks} />
              <TagInput label="Hooks to avoid" tags={avoidedHooks} onChange={setAvoidedHooks} placeholder="e.g. fomo, urgence…" />
            </Section>
          </CollapsibleSection>

          {/* SECTION 5 — Campaign Context (collapsed by default — advanced) */}
          <CollapsibleSection title="Campaign Context" badge="Advanced" defaultOpen={false}>
            <Section title="Campaign Objective">
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_OBJECTIVES.map((obj) => (
                  <button key={obj} type="button" onClick={() => setCurrentCampaignObjective(currentCampaignObjective === obj ? "" : obj)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors capitalize ${currentCampaignObjective === obj ? "bg-black text-white border-black" : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)]"}`}>
                    {obj}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Current Promotion">
              <input type="text" value={currentPromotion} onChange={(e) => setCurrentPromotion(e.target.value)}
                placeholder="e.g. Summer Sale — 20% off all skincare…"
                className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Seasonal Constraints">
                <TagInput label="Constraints" tags={seasonalConstraints} onChange={setSeasonalConstraints} placeholder="e.g. no summer imagery in Dec…" />
              </Section>
              <Section title="Legal Constraints">
                <TagInput label="Constraints" tags={legalConstraints} onChange={setLegalConstraints} placeholder="e.g. must include disclaimer…" />
              </Section>
            </div>
          </CollapsibleSection>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Products
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "products" && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-[var(--sf-text-secondary)] max-w-xl">
              Define each product with its images, icons, and moodboard. These assets are passed directly to the ad generation pipeline.
            </p>
            <button type="button" onClick={addProduct}
              className="flex-shrink-0 px-4 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
              + Add product
            </button>
          </div>

          {products.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--sf-border)] rounded-2xl p-12 text-center">
              <p className="text-sm font-medium text-[var(--sf-text-secondary)] mb-1">No products yet</p>
              <p className="text-xs text-[var(--sf-text-muted)] mb-4">Add a product to define its images, icons, and moodboard.</p>
              <button type="button" onClick={addProduct} className="px-4 py-2 text-sm font-medium bg-[var(--sf-bg-elevated)] rounded-lg transition-colors">
                + Add product
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={i}
                  brandId={brandId}
                  onUpdate={(patch) => updateProduct(i, patch)}
                  onRemove={() => removeProduct(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom save bar */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--sf-border)]">
        <p className="text-sm text-[var(--sf-text-secondary)]">
          All changes are applied to future creatives for this brand.
        </p>
        <SaveButton />
      </div>
    </div>
  );
}
