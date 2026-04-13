"use client";

// Creative generation — 3-step wizard (STA-95 Phase C)
// Step 1: Pick a Product
// Step 2: Pick an Inspiration (auto or manual from library)
// Step 3: Settings (format, quality, brief) + Generate

import { useState, useEffect, useRef } from "react";
import type { AdFormat } from "@/types/index";
import CreativePreviewModal, {
  type InspirationSource,
  type CreativePreviewData,
} from "@/components/CreativePreviewModal";
import { Loader2, Wand2, Zap, Layers, Check, ChevronRight } from "lucide-react";

// ── Prop types ────────────────────────────────────────────────────────────────

interface ExistingCreative {
  id: string;
  imageUrl: string | null;
  status: string;
  score: number | null;
  format: string;
  angle: string;
  createdAt: string;
}

interface ProductSummary {
  id: string;
  name: string;
  description: string | null;
  tagline: string | null;
  price: string | null;
  productImages: string[];
  isDefault: boolean;
  benefits: string[];
}

interface InspirationSummary {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  analysisJson: Record<string, unknown>;
  analyzedAt: string | null;
}

interface Props {
  brandId: string;
  brandName: string;
  hasLogo: boolean;
  existingCreatives: ExistingCreative[];
  products: ProductSummary[];
  inspirations: InspirationSummary[];
}

// ── Options ───────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS: { value: AdFormat; label: string; desc: string }[] = [
  { value: "1080x1080", label: "Square", desc: "1080×1080 — Feed" },
  { value: "1080x1350", label: "Portrait", desc: "1080×1350 — Stories" },
  { value: "1200x628", label: "Landscape", desc: "1200×628 — Banner" },
];

type ImageQuality = "flash" | "pro";

const QUALITY_OPTIONS: {
  value: ImageQuality;
  label: string;
  desc: string;
  badge: string;
}[] = [
  {
    value: "flash",
    label: "Flash (Best quality)",
    desc: "Highest brand accuracy — ideal for hero creatives",
    badge: "Recommended",
  },
  {
    value: "pro",
    label: "Pro (Cost-effective)",
    desc: "Good quality at lower cost — ideal for batch testing",
    badge: "Budget",
  },
];

const HOOK_ANGLES = [
  { value: "benefit", label: "Benefit" },
  { value: "pain", label: "Pain point" },
  { value: "social_proof", label: "Social proof" },
  { value: "curiosity", label: "Curiosity" },
  { value: "fomo", label: "FOMO" },
  { value: "urgency", label: "Urgency" },
  { value: "authority", label: "Authority" },
];

// Step progress bar steps
const WIZARD_STEPS = [
  { label: "Product" },
  { label: "Inspiration" },
  { label: "Generate" },
];

// Generation progress stages (shown during API call)
const GEN_STAGES = [
  { label: "Claude is writing the creative brief…", pct: 20 },
  { label: "Gemini is generating the image…", pct: 65 },
  { label: "Claude QA is reviewing the result…", pct: 90 },
];

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {WIZARD_STEPS.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done
                    ? "bg-[var(--sf-accent)] text-white"
                    : active
                    ? "border-2 border-[var(--sf-accent)] text-[var(--sf-accent)] bg-transparent"
                    : "border border-[var(--sf-border)] text-[var(--sf-text-muted)] bg-transparent"
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  active
                    ? "text-[var(--sf-text-primary)]"
                    : done
                    ? "text-[var(--sf-accent)]"
                    : "text-[var(--sf-text-muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 mx-3 text-[var(--sf-text-muted)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CreativeThumbnail({
  c,
  brandName,
  onPreview,
}: {
  c: ExistingCreative;
  brandName: string;
  onPreview?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-[var(--sf-border)] aspect-square bg-[var(--sf-bg-primary)] flex items-center justify-center relative group">
        {c.imageUrl && !c.imageUrl.startsWith("data:image/png;base64,data") ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {onPreview && (
                <button
                  type="button"
                  onClick={onPreview}
                  title="Preview"
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 transition-colors flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
              <a
                href={c.imageUrl}
                download={`${brandName}_${c.angle}_${c.format}.png`}
                onClick={(e) => e.stopPropagation()}
                title="Download"
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 transition-colors flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            </div>
          </>
        ) : (
          <span className="text-xs text-[var(--sf-text-muted)] text-center px-2">
            {c.status === "GENERATING" ? "Generating…" : "No preview"}
          </span>
        )}
      </div>
      <div className="text-xs text-[var(--sf-text-secondary)] flex items-center gap-1 flex-wrap">
        <span
          className={`inline-block px-2 py-0.5 rounded-full ${
            c.status === "APPROVED"
              ? "bg-green-50 text-green-700"
              : c.status === "REJECTED"
              ? "bg-red-50 text-red-700"
              : c.status === "GENERATING"
              ? "bg-blue-50 text-blue-600"
              : "bg-[var(--sf-bg-elevated)] text-[var(--sf-text-secondary)]"
          }`}
        >
          {c.status === "GENERATING" ? "…" : c.status}
        </span>
        <span className="capitalize">{c.angle}</span>
        {c.score != null && <span>{Math.round(c.score * 100)}%</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SingleResult {
  creative: ExistingCreative;
  qaResult: {
    approved: boolean;
    score: number;
    feedback: string;
    iterations: number;
  };
  inspirationSource?: InspirationSource;
}

export default function GenerateClient({
  brandId,
  brandName,
  hasLogo,
  existingCreatives,
  products,
  inspirations,
}: Props) {
  // Wizard step: 0 = Product, 1 = Inspiration, 2 = Settings/Generate
  const [step, setStep] = useState(0);

  // Step 1 — Product
  const defaultProduct = products.find((p) => p.isDefault) ?? products[0] ?? null;
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    defaultProduct?.id ?? null
  );

  // Step 2 — Inspiration
  // "auto" = Claude picks from library, "manual" = user picks from gallery, "none" = skip (use BDD templates)
  const [inspirationMode, setInspirationMode] = useState<"auto" | "manual" | "none">("auto");
  const [selectedInspirationId, setSelectedInspirationId] = useState<string | null>(null);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [autoSelectedId, setAutoSelectedId] = useState<string | null>(null);
  const [inspirationFilter, setInspirationFilter] = useState<string>("");
  const [hookAngle, setHookAngle] = useState<string>("benefit");

  // Step 3 — Settings
  const [format, setFormat] = useState<AdFormat>("1080x1080");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("flash");
  const [creativeBrief, setCreativeBrief] = useState<string>("");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);

  // Creative history
  const [creatives, setCreatives] = useState<ExistingCreative[]>(existingCreatives);

  // Lightbox
  const [previewCreative, setPreviewCreative] = useState<{
    creative: CreativePreviewData;
    inspirationSource?: InspirationSource;
  } | null>(null);

  const hasInspiration = inspirations.length > 0;
  const analyzedInspirations = inspirations.filter((i) => i.analyzedAt);

  // Derive the effective inspirationId for the API call
  const effectiveInspirationId =
    inspirationMode === "auto"
      ? autoSelectedId
      : inspirationMode === "manual"
      ? selectedInspirationId
      : null;

  // Auto-select inspiration via API when entering step 2 in auto mode
  useEffect(() => {
    if (step !== 1 || inspirationMode !== "auto" || analyzedInspirations.length === 0) return;
    let cancelled = false;

    async function doAutoSelect() {
      setAutoSelecting(true);
      setAutoSelectedId(null);
      try {
        const res = await fetch(
          `/api/brands/${brandId}/inspirations/auto-select`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ angle: hookAngle }),
          }
        );
        if (!res.ok) throw new Error("Auto-select failed");
        const data = await res.json();
        if (!cancelled) setAutoSelectedId(data.inspirationId ?? null);
      } catch {
        // Fall back silently — generation will use BDD templates
        if (!cancelled) setAutoSelectedId(null);
      } finally {
        if (!cancelled) setAutoSelecting(false);
      }
    }

    doAutoSelect();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inspirationMode, hookAngle]);

  // Animate through GEN_STAGES while generating
  const startStages = () => {
    setStageIndex(0);
    let current = 0;
    const advance = () => {
      current++;
      if (current < GEN_STAGES.length) {
        setStageIndex(current);
        const delays = [10000, 30000];
        stageTimerRef.current = setTimeout(advance, delays[current - 1] ?? 15000);
      }
    };
    stageTimerRef.current = setTimeout(advance, 8000);
  };

  const stopStages = () => {
    if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    setStageIndex(-1);
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setSingleResult(null);
    startStages();

    try {
      const res = await fetch("/api/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          format,
          angle: hookAngle,
          imageQuality,
          creativeBrief: creativeBrief.trim() || undefined,
          inspirationId: effectiveInspirationId ?? undefined,
          productId: selectedProductId ?? undefined,
          generationMode:
            inspirationMode === "auto"
              ? "auto"
              : inspirationMode === "manual"
              ? "manual"
              : "none",
        }),
      });
      stopStages();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setSingleResult({
        creative: data.creative,
        qaResult: data.qaResult,
        inspirationSource: data.inspirationSource,
      });
      setCreatives((prev) => [data.creative, ...prev]);
    } catch (err) {
      stopStages();
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // Inspiration card for gallery
  const InspirationCard = ({ ins }: { ins: InspirationSummary }) => {
    const analysis = ins.analysisJson as {
      hookAngle?: string;
      layoutType?: string;
      adFormat?: string;
      mood?: string;
    };
    const isSelected = selectedInspirationId === ins.id;

    return (
      <button
        type="button"
        onClick={() => setSelectedInspirationId(isSelected ? null : ins.id)}
        className={`relative rounded-xl overflow-hidden border-2 transition-all text-left group ${
          isSelected
            ? "border-[var(--sf-accent)] ring-2 ring-[var(--sf-accent)]/20"
            : "border-[var(--sf-border)] hover:border-gray-400"
        }`}
      >
        <div className="aspect-square bg-[var(--sf-bg-primary)] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ins.thumbnailUrl ?? ins.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--sf-accent)] flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {analysis.hookAngle && (
          <div className="px-2 py-1.5 border-t border-[var(--sf-border)] bg-[var(--sf-bg-secondary)]">
            <p className="text-xs font-medium text-[var(--sf-text-primary)] capitalize truncate">
              {analysis.hookAngle}
            </p>
            {analysis.layoutType && (
              <p className="text-xs text-[var(--sf-text-muted)] truncate">
                {analysis.layoutType}
              </p>
            )}
          </div>
        )}
      </button>
    );
  };

  // Filter inspirations by keyword (hookAngle or layoutType)
  const filteredInspirations = inspirations.filter((ins) => {
    if (!inspirationFilter) return true;
    const a = ins.analysisJson as { hookAngle?: string; layoutType?: string };
    const q = inspirationFilter.toLowerCase();
    return (
      a.hookAngle?.toLowerCase().includes(q) ||
      a.layoutType?.toLowerCase().includes(q)
    );
  });

  // ── Step renders ─────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-text-primary)] mb-1">
          Which product are you promoting?
        </h2>
        <p className="text-sm text-[var(--sf-text-secondary)]">
          The product DNA drives what Claude writes and what Gemini renders.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sf-border)] p-8 text-center">
          <Layers className="w-8 h-8 mx-auto mb-3 text-[var(--sf-text-muted)]" />
          <p className="text-sm font-medium text-[var(--sf-text-primary)]">No products yet</p>
          <p className="text-xs text-[var(--sf-text-secondary)] mt-1 mb-4">
            Add at least one product to get started
          </p>
          <a
            href={`/dashboard/brands/${brandId}/products/new`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--sf-accent)" }}
          >
            Add product
          </a>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => {
            const selected = selectedProductId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProductId(p.id)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  selected
                    ? "border-[var(--sf-accent)] bg-[var(--sf-accent-muted,rgba(108,71,255,0.06))]"
                    : "border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] hover:border-gray-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  {p.productImages[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.productImages[0]}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-[var(--sf-border)]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg flex-shrink-0 bg-[var(--sf-bg-elevated)] flex items-center justify-center">
                      <Layers className="w-5 h-5 text-[var(--sf-text-muted)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-[var(--sf-text-primary)] truncate">
                        {p.name}
                      </p>
                      {p.isDefault && (
                        <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-[var(--sf-bg-elevated)] text-[var(--sf-text-muted)]">
                          Default
                        </span>
                      )}
                    </div>
                    {p.tagline && (
                      <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5 truncate">
                        {p.tagline}
                      </p>
                    )}
                    {p.price && (
                      <p className="text-xs text-[var(--sf-text-muted)] mt-0.5">{p.price}</p>
                    )}
                    {p.benefits.length > 0 && (
                      <p className="text-xs text-[var(--sf-text-muted)] mt-1 truncate">
                        {p.benefits.slice(0, 2).join(" · ")}
                      </p>
                    )}
                  </div>
                  {selected && (
                    <Check className="w-5 h-5 flex-shrink-0 text-[var(--sf-accent)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <div />
        <button
          type="button"
          onClick={() => setStep(1)}
          disabled={!selectedProductId && products.length > 0}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: "var(--sf-accent)" }}
        >
          Next: Inspiration
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-text-primary)] mb-1">
          Choose an inspiration
        </h2>
        <p className="text-sm text-[var(--sf-text-secondary)]">
          An inspiration teaches Claude &amp; Gemini the exact structure to clone.
        </p>
      </div>

      {/* Hook angle picker — used for both auto-select and passed to generation */}
      <div>
        <label className="block text-xs font-medium text-[var(--sf-text-muted)] mb-2 uppercase tracking-wide">
          Hook angle
        </label>
        <div className="flex flex-wrap gap-2">
          {HOOK_ANGLES.map((h) => (
            <button
              key={h.value}
              type="button"
              onClick={() => setHookAngle(h.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                hookAngle === h.value
                  ? "border-[var(--sf-accent)] bg-[var(--sf-accent)] text-white"
                  : "border-[var(--sf-border)] text-[var(--sf-text-secondary)] hover:border-gray-400"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inspiration mode */}
      <div className="grid sm:grid-cols-3 gap-2">
        {[
          {
            value: "auto" as const,
            icon: <Wand2 className="w-4 h-4" />,
            title: "Auto-select",
            desc: "Claude picks the best match from your library",
            disabled: analyzedInspirations.length === 0,
          },
          {
            value: "manual" as const,
            icon: <Layers className="w-4 h-4" />,
            title: "Pick manually",
            desc: "Choose from your inspiration gallery",
            disabled: inspirations.length === 0,
          },
          {
            value: "none" as const,
            icon: <Zap className="w-4 h-4" />,
            title: "Skip",
            desc: "Use global BDD template library instead",
            disabled: false,
          },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => setInspirationMode(opt.value)}
            className={`relative rounded-xl border-2 p-4 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              inspirationMode === opt.value
                ? "border-[var(--sf-accent)] bg-[var(--sf-accent-muted,rgba(108,71,255,0.06))]"
                : "border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] hover:border-gray-400"
            }`}
          >
            <div
              className={`mb-2 ${
                inspirationMode === opt.value
                  ? "text-[var(--sf-accent)]"
                  : "text-[var(--sf-text-muted)]"
              }`}
            >
              {opt.icon}
            </div>
            <p className="text-sm font-semibold text-[var(--sf-text-primary)]">
              {opt.title}
            </p>
            <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5 leading-snug">
              {opt.desc}
            </p>
            {opt.disabled && (
              <p className="text-xs text-[var(--sf-warning)] mt-1">
                {opt.value === "auto" ? "Analyze inspirations first" : "Upload inspirations first"}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Auto-select: show the picked inspiration */}
      {inspirationMode === "auto" && (
        <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] p-4">
          {autoSelecting ? (
            <div className="flex items-center gap-3 text-sm text-[var(--sf-text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--sf-accent)]" />
              Claude is picking the best inspiration for "{hookAngle}" angle…
            </div>
          ) : autoSelectedId ? (
            (() => {
              const ins = inspirations.find((i) => i.id === autoSelectedId);
              if (!ins) return null;
              const a = ins.analysisJson as { hookAngle?: string; layoutType?: string };
              return (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ins.thumbnailUrl ?? ins.imageUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border border-[var(--sf-border)]"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Check className="w-4 h-4 text-[var(--sf-success)]" />
                      <span className="text-sm font-semibold text-[var(--sf-text-primary)]">
                        Best match selected
                      </span>
                    </div>
                    <p className="text-xs text-[var(--sf-text-secondary)] capitalize">
                      {a.hookAngle} · {a.layoutType}
                    </p>
                  </div>
                </div>
              );
            })()
          ) : analyzedInspirations.length === 0 ? (
            <p className="text-sm text-[var(--sf-text-muted)]">
              No analyzed inspirations yet.{" "}
              <a
                href={`/dashboard/brands/${brandId}/inspirations`}
                className="text-[var(--sf-accent)] hover:underline"
              >
                Add &amp; analyze inspirations →
              </a>
            </p>
          ) : (
            <p className="text-sm text-[var(--sf-text-muted)]">
              No match found — will fall back to global templates.
            </p>
          )}
        </div>
      )}

      {/* Manual: filterable gallery */}
      {inspirationMode === "manual" && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Filter by hook or layout…"
            value={inspirationFilter}
            onChange={(e) => setInspirationFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] text-sm text-[var(--sf-text-primary)] placeholder:text-[var(--sf-text-muted)] outline-none focus:border-[var(--sf-accent)] transition-colors"
          />
          {filteredInspirations.length === 0 ? (
            <p className="text-sm text-[var(--sf-text-muted)] text-center py-6">
              No inspirations match this filter.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
              {filteredInspirations.map((ins) => (
                <InspirationCard key={ins.id} ins={ins} />
              ))}
            </div>
          )}
          {!hasInspiration && (
            <p className="text-sm text-[var(--sf-text-muted)] text-center py-4">
              No inspirations yet.{" "}
              <a
                href={`/dashboard/brands/${brandId}/inspirations`}
                className="text-[var(--sf-accent)] hover:underline"
              >
                Upload some →
              </a>
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(0)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--sf-border)] text-[var(--sf-text-secondary)] hover:border-gray-400 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
          style={{ background: "var(--sf-accent)" }}
        >
          Next: Settings
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-text-primary)] mb-1">
          Settings &amp; Generate
        </h2>
        <p className="text-sm text-[var(--sf-text-secondary)]">
          Final options before we send it to Claude &amp; Gemini.
        </p>
      </div>

      {/* Format */}
      <div>
        <label className="block text-xs font-medium text-[var(--sf-text-muted)] mb-2 uppercase tracking-wide">
          Ad format
        </label>
        <div className="flex gap-2 flex-wrap">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                format === f.value
                  ? "border-[var(--sf-accent)] bg-[var(--sf-accent)] text-white"
                  : "border-[var(--sf-border)] text-[var(--sf-text-secondary)] hover:border-gray-400"
              }`}
            >
              <div>{f.label}</div>
              <div
                className={`text-xs font-normal ${format === f.value ? "text-white/70" : "text-[var(--sf-text-muted)]"}`}
              >
                {f.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div>
        <label className="block text-xs font-medium text-[var(--sf-text-muted)] mb-2 uppercase tracking-wide">
          Image quality
        </label>
        <div className="grid sm:grid-cols-2 gap-2">
          {QUALITY_OPTIONS.map((q) => (
            <button
              key={q.value}
              type="button"
              onClick={() => setImageQuality(q.value)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                imageQuality === q.value
                  ? "border-[var(--sf-accent)] bg-[var(--sf-accent-muted,rgba(108,71,255,0.06))]"
                  : "border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] hover:border-gray-400"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-[var(--sf-text-primary)]">
                  {q.label}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    q.badge === "Recommended"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {q.badge}
                </span>
              </div>
              <p className="text-xs text-[var(--sf-text-secondary)] leading-snug">{q.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Optional brief */}
      <div>
        <label className="block text-xs font-medium text-[var(--sf-text-muted)] mb-2 uppercase tracking-wide">
          Creative direction <span className="normal-case font-normal">(optional)</span>
        </label>
        <textarea
          value={creativeBrief}
          onChange={(e) => setCreativeBrief(e.target.value)}
          placeholder="E.g. 'Focus on the 30-day free trial offer' or 'Winter season — cold imagery'"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] text-sm text-[var(--sf-text-primary)] placeholder:text-[var(--sf-text-muted)] resize-none outline-none focus:border-[var(--sf-accent)] transition-colors"
        />
        <p className="text-xs text-[var(--sf-text-muted)] mt-1">
          Priority: Inspiration structure → Product DNA → Brand DNA → your direction above
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] p-4 space-y-2 text-sm">
        <p className="text-xs font-medium text-[var(--sf-text-muted)] uppercase tracking-wide mb-3">
          Generation summary
        </p>
        <div className="flex justify-between">
          <span className="text-[var(--sf-text-secondary)]">Product</span>
          <span className="text-[var(--sf-text-primary)] font-medium">
            {products.find((p) => p.id === selectedProductId)?.name ?? "None (brand DNA only)"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--sf-text-secondary)]">Inspiration</span>
          <span className="text-[var(--sf-text-primary)] font-medium capitalize">
            {inspirationMode === "auto" && autoSelectedId
              ? "Auto-selected"
              : inspirationMode === "manual" && selectedInspirationId
              ? "Manual pick"
              : "BDD templates (fallback)"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--sf-text-secondary)]">Hook angle</span>
          <span className="text-[var(--sf-text-primary)] font-medium capitalize">{hookAngle}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--sf-text-secondary)]">Format</span>
          <span className="text-[var(--sf-text-primary)] font-medium">
            {FORMAT_OPTIONS.find((f) => f.value === format)?.label} ({format})
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      {/* Progress bar during generation */}
      {generating && stageIndex >= 0 && (
        <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-[var(--sf-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--sf-accent)]" />
            <span>{GEN_STAGES[stageIndex]?.label}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--sf-bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${GEN_STAGES[stageIndex]?.pct ?? 0}%`,
                background: "var(--sf-accent)",
              }}
            />
          </div>
        </div>
      )}

      {/* Single result */}
      {singleResult && (
        <div className="rounded-xl border border-[var(--sf-border)] overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-[var(--sf-border)]">
            <div>
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold mr-2 ${
                  singleResult.qaResult.approved
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {singleResult.qaResult.approved ? "Approved" : "QA Review"}
              </span>
              <span className="text-sm text-[var(--sf-text-secondary)]">
                Score: {Math.round(singleResult.qaResult.score * 100)}%
              </span>
            </div>
            {singleResult.creative.imageUrl && (
              <a
                href={singleResult.creative.imageUrl}
                download={`${brandName}_creative.png`}
                className="text-sm font-medium text-[var(--sf-accent)] hover:underline"
              >
                Download
              </a>
            )}
          </div>
          {singleResult.creative.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={singleResult.creative.imageUrl}
              alt="Generated creative"
              className="w-full max-h-96 object-contain bg-[var(--sf-bg-primary)]"
            />
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => { setStep(1); setSingleResult(null); setError(null); }}
          className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--sf-border)] text-[var(--sf-text-secondary)] hover:border-gray-400 transition-colors"
          disabled={generating}
        >
          ← Back
        </button>
        <div className="flex flex-col items-end gap-2">
          {!hasLogo && (
            <p className="text-xs text-red-500 font-medium">
              Add your brand logo to continue — required for on-brand creatives.
            </p>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={generating || !hasLogo}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-60 transition-opacity"
            style={{ background: "var(--sf-accent)" }}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : singleResult ? (
              <>
                <Wand2 className="w-4 h-4" />
                Regenerate
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Creative
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-[var(--sf-text-secondary)] mb-1 flex items-center gap-1.5 flex-wrap">
          <a href="/dashboard" className="hover:underline">
            Dashboard
          </a>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="flex-shrink-0 text-[var(--sf-text-muted)]"
          >
            <path
              d="M4.5 2.5l4 3.5-4 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <a href={`/dashboard/brands/${brandId}`} className="hover:underline">
            Brand DNA
          </a>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="flex-shrink-0 text-[var(--sf-text-muted)]"
          >
            <path
              d="M4.5 2.5l4 3.5-4 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Generate</span>
        </p>
        <h1 className="text-2xl font-bold text-[var(--sf-text-primary)]">
          {brandName} — Generate Creative
        </h1>
        <p className="text-sm text-[var(--sf-text-secondary)] mt-1">
          Clone inspiration structure · Fill with product DNA · Brand identity applied throughout
        </p>
      </div>

      {/* Two-column: wizard left, history right */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        {/* Wizard */}
        <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-6">
          <StepBar currentStep={step} />
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>

        {/* Creative history */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--sf-text-primary)]">
            Recent creatives
          </h3>
          {creatives.length === 0 ? (
            <p className="text-xs text-[var(--sf-text-muted)]">
              No creatives yet — generate your first one.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {creatives.slice(0, 12).map((c) => (
                <CreativeThumbnail
                  key={c.id}
                  c={c}
                  brandName={brandName}
                  onPreview={() =>
                    setPreviewCreative({
                      creative: {
                        id: c.id,
                        imageUrl: c.imageUrl,
                        status: c.status,
                        score: c.score,
                        format: c.format,
                        angle: c.angle,
                      },
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {previewCreative && (
        <CreativePreviewModal
          creative={previewCreative.creative}
          inspirationSource={previewCreative.inspirationSource}
          brandName={brandName}
          onClose={() => setPreviewCreative(null)}
        />
      )}
    </div>
  );
}
