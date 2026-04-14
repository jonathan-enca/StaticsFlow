"use client";

// Creative generation — 3-step wizard (STA-105)
// Step 1: Pick a Product
// Step 2: Generation mode — Replicate (from library or Upload/URL) vs Batch
// Step 3: Settings (format, quality, brief, batch count) + Generate

import { useState, useEffect, useRef } from "react";
import type { AdFormat } from "@/types/index";
import CreativePreviewModal, {
  type InspirationSource,
  type CreativePreviewData,
} from "@/components/CreativePreviewModal";
import {
  Loader2,
  Wand2,
  Zap,
  Layers,
  Check,
  ChevronRight,
  Upload,
  BookImage,
} from "lucide-react";

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
  /** Global BDD template count — warning shown when below 1 000 */
  templateCount: number;
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
    value: "pro",
    label: "Pro (Highest quality)",
    desc: "Highest brand accuracy — ideal for hero creatives",
    badge: "Recommended",
  },
  {
    value: "flash",
    label: "Flash (Fast & cost-effective)",
    desc: "Good quality at lower cost — ideal for batch testing",
    badge: "Budget",
  },
];

const BATCH_COUNT_OPTIONS: { value: 5 | 10 | 20; label: string }[] = [
  { value: 5, label: "5 images" },
  { value: 10, label: "10 images" },
  { value: 20, label: "20 images" },
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

// STA-123: Inline CTA card surfacing the Inspiration Library to users with 0 inspirations.
// Appears between row 1 and row 2 of the creative history grid, or above the empty state.
// Dismissed permanently via localStorage key "inspirations_cta_dismissed".
function InspirationUploadCta({
  brandId,
  onDismiss,
}: {
  brandId: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-xl border p-4 space-y-2"
      style={{ background: "var(--sf-bg-elevated)", borderColor: "var(--sf-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold" style={{ color: "var(--sf-text-primary)" }}>
          Level up your creatives
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss inspiration CTA"
          className="flex-shrink-0 text-xs hover:opacity-60 transition-opacity"
          style={{ color: "var(--sf-text-muted)" }}
        >
          ✕
        </button>
      </div>
      <p className="text-xs leading-snug" style={{ color: "var(--sf-text-secondary)" }}>
        Add inspiration ads from your brand or competitors. The more examples you give
        StaticsFlow, the more on-brand your output becomes.
      </p>
      <a
        href={`/dashboard/brands/${brandId}/inspirations`}
        className="inline-block text-xs font-semibold hover:underline"
        style={{ color: "var(--sf-accent)" }}
      >
        Add inspirations →
      </a>
    </div>
  );
}

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
  templateCount,
}: Props) {
  // Wizard step: 0 = Product, 1 = Inspiration mode, 2 = Settings/Generate
  const [step, setStep] = useState(0);

  // Step 1 — Product
  const defaultProduct = products.find((p) => p.isDefault) ?? products[0] ?? null;
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    defaultProduct?.id ?? null
  );

  // Step 2 — Generation mode
  // "replicate" = clone a specific ad, "batch" = generate N from DBB library
  const [inspirationMode, setInspirationMode] = useState<"replicate" | "batch">("replicate");

  // Replicate sub-path
  const [replicateSource, setReplicateSource] = useState<"library" | "upload">("library");
  const [selectedInspirationId, setSelectedInspirationId] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<string>("");

  // Replicate — upload/URL sub-path
  const [uploadUrl, setUploadUrl] = useState<string>("");
  const [uploadImageData, setUploadImageData] = useState<{
    data: string;
    mimeType: string;
  } | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Step 3 — Settings
  const [batchCount, setBatchCount] = useState<5 | 10 | 20>(5);
  const [format, setFormat] = useState<AdFormat>("1080x1080");
  // Default to "pro" for single-creative generation (STA-127 #3).
  // Batch mode keeps "flash" since volume runs where speed/cost matter more.
  const [imageQuality, setImageQuality] = useState<ImageQuality>("pro");
  const [creativeBrief, setCreativeBrief] = useState<string>("");

  // Generation state (replicate — single result)
  const [generating, setGenerating] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);

  // Generation state (batch)
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<ExistingCreative[]>([]);
  const [batchStatus, setBatchStatus] = useState<
    "PENDING" | "RUNNING" | "DONE" | "FAILED" | null
  >(null);
  const [batchTotal, setBatchTotal] = useState<number>(0);
  const [batchCompleted, setBatchCompleted] = useState<number>(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Post-generation prompt (replicate + upload/URL)
  const [canSaveAsInspiration, setCanSaveAsInspiration] = useState(false);
  const [inspirationPromptDismissed, setInspirationPromptDismissed] = useState(false);

  // STA-123: Inspiration Library upload CTA (dismissed via localStorage)
  const [inspirationCtaDismissed, setInspirationCtaDismissed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setInspirationCtaDismissed(
        localStorage.getItem("inspirations_cta_dismissed") === "true"
      );
    }
  }, []);
  const dismissInspirationCta = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("inspirations_cta_dismissed", "true");
    }
    setInspirationCtaDismissed(true);
  };

  // STA-111: soft nudge when selected product has no images (dismissable, non-blocking)
  const [productNudgeDismissed, setProductNudgeDismissed] = useState(false);

  // Creative history
  const [creatives, setCreatives] = useState<ExistingCreative[]>(existingCreatives);

  // Lightbox
  const [previewCreative, setPreviewCreative] = useState<{
    creative: CreativePreviewData;
    inspirationSource?: InspirationSource;
  } | null>(null);

  // ── Batch polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!batchId || batchStatus === "DONE" || batchStatus === "FAILED") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/creatives/batch/${batchId}`);
        if (!res.ok) return;
        const { batch } = await res.json();
        setBatchStatus(batch.status);
        setBatchTotal(batch.totalCount);
        setBatchCompleted(batch.completedCount);
        // Stream results in as they arrive
        const completedCreatives: ExistingCreative[] = batch.creatives.filter(
          (c: ExistingCreative) => c.status !== "GENERATING"
        );
        setBatchResults(completedCreatives);
        // Add newly-done creatives to the history panel
        setCreatives((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newOnes = completedCreatives.filter((c) => !existingIds.has(c.id));
          return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
        });
        if (batch.status === "DONE" || batch.status === "FAILED") {
          setGenerating(false);
          stopStages();
        }
      } catch {
        // ignore transient errors
      }
    };

    poll(); // immediate first check
    pollIntervalRef.current = setInterval(poll, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, batchStatus]);

  // ── Stage animation ────────────────────────────────────────────────────────

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

  // ── File upload handler ────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadUrl(""); // clear URL when file selected
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const [header, data] = result.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      setUploadImageData({ data, mimeType });
      setUploadPreview(result);
    };
    reader.readAsDataURL(file);
  };

  // ── Generate ───────────────────────────────────────────────────────────────

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setSingleResult(null);
    setBatchId(null);
    setBatchResults([]);
    setBatchStatus(null);
    setBatchTotal(0);
    setBatchCompleted(0);
    setCanSaveAsInspiration(false);
    setInspirationPromptDismissed(false);
    startStages();

    if (inspirationMode === "batch") {
      // ── Batch path: fire-and-forget + polling ──────────────────────────────
      try {
        const res = await fetch("/api/creatives/batch-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId,
            count: batchCount,
            formats: [format],
            generationMode: "batch",
            productId: selectedProductId ?? undefined,
            imageQuality,
            creativeBrief: creativeBrief.trim() || undefined,
          }),
        });
        stopStages();
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Batch generation failed");
        setBatchId(data.batchId);
        setBatchStatus("PENDING");
        setBatchTotal(batchCount);
        // generating stays true — polling will flip it when done
      } catch (err) {
        stopStages();
        setError((err as Error).message);
        setGenerating(false);
      }
      return;
    }

    // ── Replicate path: single creative ────────────────────────────────────
    try {
      const body: Record<string, unknown> = {
        brandId,
        format,
        imageQuality,
        generationMode: "replicate",
        creativeBrief: creativeBrief.trim() || undefined,
        productId: selectedProductId ?? undefined,
      };

      if (replicateSource === "library" && selectedInspirationId) {
        body.inspirationId = selectedInspirationId;
      } else if (replicateSource === "upload") {
        if (uploadImageData) {
          body.referenceImageData = uploadImageData;
        } else if (uploadUrl.trim()) {
          body.inspirationImageUrl = uploadUrl.trim();
        }
      }

      const res = await fetch("/api/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      if (data.canSaveAsInspiration) setCanSaveAsInspiration(true);
    } catch (err) {
      stopStages();
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const filteredInspirations = inspirations.filter((ins) => {
    if (!libraryFilter) return true;
    const a = ins.analysisJson as { hookAngle?: string; layoutType?: string };
    const q = libraryFilter.toLowerCase();
    return (
      a.hookAngle?.toLowerCase().includes(q) ||
      a.layoutType?.toLowerCase().includes(q)
    );
  });

  // Step 2 "Next" button validity
  const step2Valid =
    inspirationMode === "batch" ||
    (replicateSource === "library" && selectedInspirationId !== null) ||
    (replicateSource === "upload" && (!!uploadImageData || uploadUrl.trim().length > 0));

  // ── Inspiration card for gallery ───────────────────────────────────────────

  const InspirationCard = ({ ins }: { ins: InspirationSummary }) => {
    const analysis = ins.analysisJson as {
      hookAngle?: string;
      layoutType?: string;
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
          How do you want to generate?
        </h2>
        <p className="text-sm text-[var(--sf-text-secondary)]">
          Replicate a single top ad, or generate a volume batch from the template library.
        </p>
      </div>

      {/* 2 mode cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          {
            value: "replicate" as const,
            icon: <BookImage className="w-5 h-5" />,
            title: "Replicate a top ad",
            desc: "1 image — Claude clones the structure of a specific high-performing ad",
          },
          {
            value: "batch" as const,
            icon: <Zap className="w-5 h-5" />,
            title: "Generate a batch",
            desc: "5–20 images — Claude picks the best DBB templates for your brand",
          },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setInspirationMode(opt.value)}
            className={`rounded-xl border-2 p-5 text-left transition-all ${
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
            <p className="text-sm font-semibold text-[var(--sf-text-primary)]">{opt.title}</p>
            <p className="text-xs text-[var(--sf-text-secondary)] mt-1 leading-snug">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* ── Replicate sub-options ────────────────────────────────────────── */}
      {inspirationMode === "replicate" && (
        <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] p-4 space-y-4">
          {/* Sub-path tabs */}
          <div className="flex gap-2">
            {[
              {
                value: "library" as const,
                icon: <BookImage className="w-3.5 h-3.5" />,
                label: "From library",
              },
              {
                value: "upload" as const,
                icon: <Upload className="w-3.5 h-3.5" />,
                label: "Upload / URL",
              },
            ].map((src) => (
              <button
                key={src.value}
                type="button"
                onClick={() => setReplicateSource(src.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  replicateSource === src.value
                    ? "border-[var(--sf-accent)] bg-[var(--sf-accent)] text-white"
                    : "border-[var(--sf-border)] text-[var(--sf-text-secondary)] hover:border-gray-400"
                }`}
              >
                {src.icon}
                {src.label}
              </button>
            ))}
          </div>

          {/* Library sub-path */}
          {replicateSource === "library" && (
            <div className="space-y-3">
              {inspirations.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-[var(--sf-text-muted)]">
                    No inspirations in your library yet.
                  </p>
                  <a
                    href={`/dashboard/brands/${brandId}/inspirations`}
                    className="text-sm text-[var(--sf-accent)] hover:underline mt-1 inline-block"
                  >
                    Upload some →
                  </a>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Filter by hook or layout…"
                    value={libraryFilter}
                    onChange={(e) => setLibraryFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg-primary)] text-sm text-[var(--sf-text-primary)] placeholder:text-[var(--sf-text-muted)] outline-none focus:border-[var(--sf-accent)] transition-colors"
                  />
                  {filteredInspirations.length === 0 ? (
                    <p className="text-sm text-[var(--sf-text-muted)] text-center py-4">
                      No inspirations match this filter.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
                      {filteredInspirations.map((ins) => (
                        <InspirationCard key={ins.id} ins={ins} />
                      ))}
                    </div>
                  )}
                  {!selectedInspirationId && (
                    <p className="text-xs text-[var(--sf-text-muted)]">
                      Select an inspiration to clone its structure.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Upload / URL sub-path */}
          {replicateSource === "upload" && (
            <div className="space-y-3">
              {/* File dropzone */}
              <div>
                <label className="block text-xs font-medium text-[var(--sf-text-muted)] mb-2 uppercase tracking-wide">
                  Upload image
                </label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-[var(--sf-border)] rounded-xl cursor-pointer hover:border-gray-400 transition-colors bg-[var(--sf-bg-primary)]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {uploadPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uploadPreview}
                      alt="Preview"
                      className="h-24 object-contain rounded-lg"
                    />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-[var(--sf-text-muted)] mb-1.5" />
                      <span className="text-xs text-[var(--sf-text-muted)]">
                        Drop image here or click to upload
                      </span>
                      <span className="text-xs text-[var(--sf-text-muted)] mt-0.5">
                        JPEG · PNG · WebP — max 10 MB
                      </span>
                    </>
                  )}
                </label>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--sf-border)]" />
                <span className="text-xs text-[var(--sf-text-muted)]">or</span>
                <div className="flex-1 h-px bg-[var(--sf-border)]" />
              </div>

              {/* URL input */}
              <div>
                <label className="block text-xs font-medium text-[var(--sf-text-muted)] mb-2 uppercase tracking-wide">
                  Paste a URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/top-ad.jpg"
                  value={uploadUrl}
                  onChange={(e) => {
                    setUploadUrl(e.target.value);
                    setUploadImageData(null);
                    setUploadPreview(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg-primary)] text-sm text-[var(--sf-text-primary)] placeholder:text-[var(--sf-text-muted)] outline-none focus:border-[var(--sf-accent)] transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Batch confirmation ───────────────────────────────────────────── */}
      {inspirationMode === "batch" && (
        <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] p-4">
          <p className="text-sm text-[var(--sf-text-secondary)]">
            Claude will automatically select the best-matching DBB templates for your product
            category and brand DNA. Angles are auto-varied across the batch (benefit, pain, social
            proof…). Set the batch count in the next step.
          </p>
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
          disabled={!step2Valid}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: "var(--sf-accent)" }}
        >
          Next: Settings
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    // STA-111: true when any product has at least one image (acceptance criterion #3)
    const hasProductWithImages = products.some((p) => p.productImages.length > 0);

    return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-text-primary)] mb-1">
          Settings &amp; Generate
        </h2>
        <p className="text-sm text-[var(--sf-text-secondary)]">
          Final options before we send it to Claude &amp; Gemini.
        </p>
      </div>

      {/* BDD library size warning — shown when global template count < 1 000 */}
      {templateCount < 1000 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">
            Inspiration library is still growing — results may be less on-brand.
          </p>
          <p className="text-xs text-amber-700 leading-snug">
            The global template library currently has {templateCount.toLocaleString()} categorized
            creatives (target: 1 000+). Brand accuracy improves significantly once the library is
            fully populated.
          </p>
          <a
            href="/admin/library"
            className="inline-block text-xs font-semibold text-amber-800 underline hover:no-underline"
          >
            Upload more inspirations →
          </a>
        </div>
      )}

      {/* STA-111 / STA-127 #4: soft warning when no product images exist */}
      {!hasProductWithImages && !productNudgeDismissed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start justify-between gap-4">
          <p className="text-sm text-amber-800">
            No product images found — Gemini may render a generic product instead of yours.
            Add a product photo for accurate brand identity.{" "}
            <a
              href={`/dashboard/brands/${brandId}/products`}
              className="font-medium underline hover:no-underline"
            >
              Add product images
            </a>
          </p>
          <button
            type="button"
            onClick={() => setProductNudgeDismissed(true)}
            className="flex-shrink-0 text-xs text-amber-600 hover:text-amber-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Batch count — batch mode only */}
      {inspirationMode === "batch" && (
        <div>
          <label className="block text-xs font-medium text-[var(--sf-text-muted)] mb-2 uppercase tracking-wide">
            Batch count
          </label>
          <div className="flex gap-2 flex-wrap">
            {BATCH_COUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBatchCount(opt.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  batchCount === opt.value
                    ? "border-[var(--sf-accent)] bg-[var(--sf-accent)] text-white"
                    : "border-[var(--sf-border)] text-[var(--sf-text-secondary)] hover:border-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
          <span className="text-[var(--sf-text-secondary)]">Mode</span>
          <span className="text-[var(--sf-text-primary)] font-medium">
            {inspirationMode === "batch"
              ? `Batch × ${batchCount}`
              : replicateSource === "library"
              ? "Replicate — from library"
              : "Replicate — from upload/URL"}
          </span>
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

      {/* Progress bar (replicate mode) */}
      {generating && inspirationMode === "replicate" && stageIndex >= 0 && (
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

      {/* Replicate single result */}
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

      {/* Save as inspiration prompt */}
      {canSaveAsInspiration && !inspirationPromptDismissed && (
        <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--sf-text-primary)]">
              Save reference as inspiration?
            </p>
            <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">
              Add this reference image to your brand library for future generations.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <a
              href={`/dashboard/brands/${brandId}/inspirations`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--sf-accent)] text-[var(--sf-accent)] hover:bg-[var(--sf-accent-muted,rgba(108,71,255,0.06))] transition-colors"
            >
              Save →
            </a>
            <button
              type="button"
              onClick={() => setInspirationPromptDismissed(true)}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--sf-text-muted)] hover:text-[var(--sf-text-secondary)] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Batch progress + streaming results */}
      {batchId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--sf-text-secondary)]">
              {batchStatus !== "DONE" && batchStatus !== "FAILED" && (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--sf-accent)]" />
              )}
              <span>
                {batchStatus === "DONE"
                  ? `Batch complete — ${batchCompleted} creative${batchCompleted !== 1 ? "s" : ""} generated`
                  : batchStatus === "FAILED"
                  ? "Batch generation failed"
                  : `Generating… ${batchCompleted} / ${batchTotal}`}
              </span>
            </div>
            {batchTotal > 0 && batchStatus !== "DONE" && batchStatus !== "FAILED" && (
              <span className="text-xs text-[var(--sf-text-muted)]">
                {Math.round((batchCompleted / batchTotal) * 100)}%
              </span>
            )}
          </div>
          {batchTotal > 0 && batchStatus !== "DONE" && batchStatus !== "FAILED" && (
            <div className="w-full h-1.5 rounded-full bg-[var(--sf-bg-elevated)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((batchCompleted / batchTotal) * 100)}%`,
                  background: "var(--sf-accent)",
                }}
              />
            </div>
          )}
          {batchResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {batchResults.map((c) => (
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
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => {
            setStep(1);
            setSingleResult(null);
            setBatchId(null);
            setBatchResults([]);
            setBatchStatus(null);
            setError(null);
          }}
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
                {inspirationMode === "batch" ? "Generating batch…" : "Generating…"}
              </>
            ) : singleResult || batchId ? (
              <>
                <Wand2 className="w-4 h-4" />
                {inspirationMode === "batch"
                  ? `New batch (${batchCount} images)`
                  : "Regenerate"}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                {inspirationMode === "batch"
                  ? `Generate Batch (${batchCount} images)`
                  : "Generate Creative"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
  };

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

          {/* STA-123: show CTA above empty state when there are no creatives yet */}
          {inspirations.length === 0 && !inspirationCtaDismissed && creatives.length === 0 && (
            <InspirationUploadCta
              brandId={brandId}
              onDismiss={dismissInspirationCta}
            />
          )}

          {creatives.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
              No creatives yet — generate your first one.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Row 1: first 2 creatives */}
              {creatives.slice(0, 2).map((c) => (
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

              {/* STA-123: CTA between row 1 and row 2 (col-span-2) */}
              {inspirations.length === 0 && !inspirationCtaDismissed && (
                <div className="col-span-2">
                  <InspirationUploadCta
                    brandId={brandId}
                    onDismiss={dismissInspirationCta}
                  />
                </div>
              )}

              {/* Remaining rows */}
              {creatives.slice(2, 12).map((c) => (
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
