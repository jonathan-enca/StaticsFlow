"use client";

// Creative generation UI
// Supports: single creative (with progress bar), 3-variant mode, and batch generation
// Batch mode: polls progress and shows gallery + Download All ZIP

import { useState, useEffect, useRef } from "react";
import type { AdFormat } from "@/types/index";

interface ExistingCreative {
  id: string;
  imageUrl: string | null;
  status: string;
  score: number | null;
  format: string;
  angle: string;
  createdAt: string;
}

interface Props {
  brandId: string;
  brandName: string;
  existingCreatives: ExistingCreative[];
}

const FORMAT_OPTIONS: { value: AdFormat; label: string; desc: string }[] = [
  { value: "1080x1080", label: "Square", desc: "1080×1080 — Feed" },
  { value: "1080x1350", label: "Portrait", desc: "1080×1350 — Stories" },
  { value: "1200x628", label: "Landscape", desc: "1200×628 — Banner" },
];

// Batch count range
const BATCH_MIN = 1;
const BATCH_MAX = 50;

type ImageQuality = "flash" | "pro";

const QUALITY_OPTIONS: { value: ImageQuality; label: string; model: string; desc: string; badge: string; badgeColor: string }[] = [
  {
    value: "flash",
    label: "Flash 3.1",
    model: "Gemini 3.1 Flash",
    desc: "Best image quality, highest brand accuracy. Most powerful model — ideal for hero creatives.",
    badge: "Best quality",
    badgeColor: "amber",
  },
  {
    value: "pro",
    label: "Pro",
    model: "Gemini 3 Pro",
    desc: "Good quality at lower cost. Ideal for bulk batches and A/B testing.",
    badge: "Cost-effective",
    badgeColor: "green",
  },
];

interface SingleResult {
  creative: ExistingCreative;
  qaResult: { approved: boolean; score: number; feedback: string; iterations: number };
}

interface BatchStatus {
  id: string;
  totalCount: number;
  completedCount: number;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  creatives: ExistingCreative[];
}

function CreativeThumbnail({ c, brandName }: { c: ExistingCreative; brandName: string }) {
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
            <a
              href={c.imageUrl}
              download={`${brandName}_${c.angle}_${c.format}.png`}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Download"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </a>
          </>
        ) : (
          <span className="text-xs text-[var(--sf-text-muted)] text-center px-2">
            {c.status === "GENERATING" ? "Generating…" : "No preview"}
          </span>
        )}
      </div>
      <div className="text-xs text-[var(--sf-text-secondary)] flex items-center gap-1 flex-wrap">
        <span className={`inline-block px-2 py-0.5 rounded-full ${
          c.status === "APPROVED" ? "bg-green-50 text-green-700"
          : c.status === "REJECTED" ? "bg-red-50 text-red-700"
          : c.status === "GENERATING" ? "bg-blue-50 text-blue-600"
          : "bg-[var(--sf-bg-elevated)] text-[var(--sf-text-secondary)]"
        }`}>
          {c.status === "GENERATING" ? "…" : c.status}
        </span>
        <span className="capitalize">{c.angle}</span>
        {c.score != null && <span>{Math.round(c.score * 100)}%</span>}
      </div>
    </div>
  );
}

// Step labels for the single-generation progress bar
const SINGLE_STEPS = [
  { label: "Claude is writing the creative brief…", pct: 20 },
  { label: "Gemini is generating the image…", pct: 65 },
  { label: "Claude QA is reviewing the result…", pct: 90 },
];

export default function GenerateClient({ brandId, brandName, existingCreatives }: Props) {
  const [format, setFormat] = useState<AdFormat>("1080x1080");
  // angle is no longer user-selectable — defaults to "benefit" for single, auto-distributed for batch
  const angle = "benefit";
  const [imageQuality, setImageQuality] = useState<ImageQuality>("flash");
  const [batchSize, setBatchSize] = useState<number>(1);
  const [batchSizeInput, setBatchSizeInput] = useState<string>("1");
  const [creativeBrief, setCreativeBrief] = useState<string>("");
  const [variantsMode, setVariantsMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single-generation step progress
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single / variants result
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
  const [variantResults, setVariantResults] = useState<SingleResult[] | null>(null);

  // Batch state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<BatchStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Historical creatives
  const [creatives, setCreatives] = useState<ExistingCreative[]>(existingCreatives);

  // Poll batch status while running
  useEffect(() => {
    if (!batchId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/creatives/batch/${batchId}`);
        if (!res.ok) return;
        const data = await res.json();
        const batch: BatchStatus = data.batch;
        setBatchData(batch);

        if (batch.status === "DONE" || batch.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setGenerating(false);
          // Add batch creatives to history
          setCreatives((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newOnes = batch.creatives.filter((c) => !existingIds.has(c.id));
            return [...newOnes, ...prev];
          });
        }
      } catch {
        // ignore transient poll errors
      }
    };

    poll(); // immediate first check
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [batchId]);

  /** Animate through SINGLE_STEPS while generation is running. */
  const startStepProgress = () => {
    setStepIndex(0);
    let current = 0;
    const advance = () => {
      current++;
      if (current < SINGLE_STEPS.length) {
        setStepIndex(current);
        // Time each step roughly proportional to its real work
        const delays = [10000, 30000]; // brief→image ~10s, image→QA ~30s
        stepTimerRef.current = setTimeout(advance, delays[current - 1] ?? 15000);
      }
    };
    stepTimerRef.current = setTimeout(advance, 8000);
  };

  const stopStepProgress = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setStepIndex(-1);
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setSingleResult(null);
    setVariantResults(null);
    setBatchId(null);
    setBatchData(null);

    const briefPayload = creativeBrief.trim() || undefined;

    try {
      if (batchSize > 1) {
        // Batch mode
        const res = await fetch("/api/creatives/batch-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId,
            count: batchSize,
            formats: [format],
            angles: ["benefit", "pain", "social_proof", "curiosity"],
            imageQuality,
            creativeBrief: briefPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Batch generation failed");
        setBatchId(data.batchId);
        // setGenerating stays true — cleared by poller when done
      } else if (variantsMode) {
        // Variants mode (3 hooks)
        startStepProgress();
        const res = await fetch("/api/creatives/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, format, angle, variants: true, imageQuality, creativeBrief: briefPayload }),
        });
        stopStepProgress();
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        setVariantResults(data.variants as SingleResult[]);
        setCreatives((prev) => [
          ...data.variants.map((v: SingleResult) => v.creative),
          ...prev,
        ]);
        setGenerating(false);
      } else {
        // Single creative
        startStepProgress();
        const res = await fetch("/api/creatives/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, format, angle, imageQuality, creativeBrief: briefPayload }),
        });
        stopStepProgress();
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        setSingleResult({ creative: data.creative, qaResult: data.qaResult });
        setCreatives((prev) => [data.creative, ...prev]);
        setGenerating(false);
      }
    } catch (err) {
      stopStepProgress();
      setError((err as Error).message);
      setGenerating(false);
    }
  };

  const downloadBatchZip = async () => {
    if (!batchId) return;
    const a = document.createElement("a");
    a.href = `/api/creatives/batch/${batchId}/export`;
    a.download = `${brandName.toLowerCase()}_batch.zip`;
    a.click();
  };

  const isBatchMode = batchSize > 1;
  const buttonLabel = isBatchMode
    ? `Generate ${batchSize} Creatives →`
    : variantsMode
    ? "Generate 3 Variants →"
    : "Generate Creative →";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-[var(--sf-text-secondary)] mb-1">
          <a href="/dashboard" className="hover:underline">Dashboard</a>
          {" / "}
          <a href={`/dashboard/brands/${brandId}`} className="hover:underline">Brand DNA</a>
          {" / "}Generate
        </p>
        <h1 className="text-2xl font-bold text-[var(--sf-text-primary)]">{brandName} — Generate Creative</h1>
        <p className="text-sm text-[var(--sf-text-secondary)] mt-1">
          Claude writes the brief · Gemini generates the image · Claude QA reviews
        </p>
      </div>

      {/* Controls — horizontal grid so everything is visible at a glance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Number of Creatives */}
        <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">Number of Creatives</h2>
            <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">1 to {BATCH_MAX}</p>
          </div>
          <input
            type="number"
            min={BATCH_MIN}
            max={BATCH_MAX}
            value={batchSizeInput}
            onChange={(e) => {
              const raw = e.target.value;
              setBatchSizeInput(raw);
              const n = parseInt(raw, 10);
              if (!isNaN(n) && n >= BATCH_MIN && n <= BATCH_MAX) {
                setBatchSize(n);
                if (n > 1) setVariantsMode(false);
              }
            }}
            onBlur={() => {
              const n = Math.min(BATCH_MAX, Math.max(BATCH_MIN, parseInt(batchSizeInput, 10) || 1));
              setBatchSize(n);
              setBatchSizeInput(String(n));
              if (n > 1) setVariantsMode(false);
            }}
            className="w-full px-4 py-3 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-primary)] text-[var(--sf-text-primary)] text-sm focus:outline-none focus:border-black transition-colors"
          />
          {/* Variants toggle — only in single mode */}
          {batchSize === 1 && (
            <label className="flex items-center justify-between cursor-pointer pt-1">
              <div>
                <span className="text-sm font-medium text-[var(--sf-text-primary)]">Variants</span>
                <p className="text-xs text-[var(--sf-text-secondary)]">3 hooks A · B · SP</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={variantsMode}
                onClick={() => setVariantsMode((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  variantsMode ? "bg-black" : "bg-[var(--sf-bg-elevated)]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-[var(--sf-bg-secondary)] transition-transform ${
                    variantsMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          )}
        </div>

        {/* 2. Creative Brief */}
        <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-5 space-y-3 sm:col-span-1 lg:col-span-1">
          <div>
            <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">Creative Brief <span className="text-[var(--sf-text-muted)] font-normal">(optional)</span></h2>
            <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">
              Specific guidance for Claude: promo, season, product…
            </p>
          </div>
          <textarea
            rows={4}
            placeholder="e.g. Summer collection, 30% off, target women 25–35…"
            value={creativeBrief}
            onChange={(e) => setCreativeBrief(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg-primary)] text-[var(--sf-text-primary)] text-sm placeholder-[var(--sf-text-muted)] focus:outline-none focus:border-black transition-colors resize-none"
          />
        </div>

        {/* 3. Image Quality */}
        <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">Image Quality</h2>
            <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">Gemini model — quality vs. cost</p>
          </div>
          <div className="space-y-2">
            {QUALITY_OPTIONS.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => setImageQuality(q.value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  imageQuality === q.value
                    ? "border-black bg-black text-white"
                    : "border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] text-[var(--sf-text-primary)] hover:border-[var(--sf-border)]"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium">{q.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    imageQuality === q.value
                      ? "bg-white/20 text-white"
                      : q.badgeColor === "amber"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700"
                  }`}>
                    {q.badge}
                  </span>
                </div>
                <p className={`text-xs leading-snug ${
                  imageQuality === q.value ? "text-white/70" : "text-[var(--sf-text-secondary)]"
                }`}>
                  {q.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Ad Format */}
        <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">Ad Format</h2>
          <div className="space-y-2">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  format === f.value
                    ? "border-black bg-black text-white"
                    : "border-[var(--sf-border)] bg-[var(--sf-bg-secondary)] text-[var(--sf-text-primary)] hover:border-[var(--sf-border)]"
                }`}
              >
                <span className="font-medium">{f.label}</span>
                <span className={`text-xs ${format === f.value ? "text-white/70" : "text-[var(--sf-text-muted)]"}`}>{f.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate button + progress */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="w-full py-4 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {isBatchMode ? "Generating batch…" : variantsMode ? "Generating variants…" : "Generating…"}
            </span>
          ) : buttonLabel}
        </button>

        {/* Step progress bar — single / variants mode only */}
        {generating && !isBatchMode && stepIndex >= 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--sf-text-secondary)]">
              <span>{SINGLE_STEPS[stepIndex]?.label}</span>
              <span>{SINGLE_STEPS[stepIndex]?.pct ?? 0}%</span>
            </div>
            <div className="h-1.5 bg-[var(--sf-bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-[2000ms] ease-out"
                style={{ width: `${SINGLE_STEPS[stepIndex]?.pct ?? 0}%` }}
              />
            </div>
            <div className="flex gap-1 pt-0.5">
              {SINGLE_STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                    i <= stepIndex ? "bg-black" : "bg-[var(--sf-bg-elevated)]"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-6">
          {/* Batch progress */}
          {batchData && (
            <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">Batch Progress</h2>
                  <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">
                    {batchData.completedCount} / {batchData.totalCount} generated
                    {" · "}
                    <span className={
                      batchData.status === "DONE" ? "text-green-600 font-medium"
                      : batchData.status === "FAILED" ? "text-red-600 font-medium"
                      : "text-blue-600"
                    }>
                      {batchData.status}
                    </span>
                  </p>
                </div>
                {batchData.status === "DONE" && (
                  <button
                    type="button"
                    onClick={downloadBatchZip}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download All
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-[var(--sf-bg-elevated)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    batchData.status === "FAILED" ? "bg-red-400" : "bg-black"
                  }`}
                  style={{ width: `${batchData.totalCount > 0 ? (batchData.completedCount / batchData.totalCount) * 100 : 0}%` }}
                />
              </div>

              {/* Batch creatives gallery */}
              {batchData.creatives.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
                  {batchData.creatives.map((c) => (
                    <CreativeThumbnail key={c.id} c={c} brandName={brandName} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Variants result */}
          {variantResults && variantResults.length > 0 && (
            <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--sf-border)]">
                <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">3 Variants Generated</h2>
                <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">Variant A · Variant B · Social Proof</p>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {variantResults.map((v, idx) => (
                  <div key={v.creative.id} className="space-y-2">
                    <div className="text-xs font-medium text-[var(--sf-text-secondary)] mb-1">
                      Variant {["A", "B", "C"][idx]} — {v.creative.angle}
                    </div>
                    <div className="rounded-xl overflow-hidden border border-[var(--sf-border)] aspect-square bg-[var(--sf-bg-primary)] flex items-center justify-center relative group">
                      {v.creative.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={v.creative.imageUrl}
                            alt={`Variant ${["A", "B", "C"][idx]}`}
                            className="w-full h-full object-cover"
                          />
                          <a
                            href={v.creative.imageUrl}
                            download={`${brandName}_variant${["A", "B", "C"][idx]}_${v.creative.angle}.png`}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--sf-text-muted)]">No preview</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--sf-text-secondary)]">
                      Score: {v.qaResult.score != null ? Math.round(v.qaResult.score * 100) : "—"}%
                      {" · "}
                      <span className={v.qaResult.approved ? "text-green-600" : "text-amber-600"}>
                        {v.qaResult.approved ? "Approved" : "Review"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single result */}
          {singleResult && (
            <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--sf-border)] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">Generated Creative</h2>
                  <p className="text-xs text-[var(--sf-text-secondary)] mt-0.5">
                    {singleResult.qaResult.iterations} QA iteration{singleResult.qaResult.iterations !== 1 ? "s" : ""}
                    {" · "}Score: {Math.round(singleResult.qaResult.score * 100)}%
                    {" · "}
                    <span className={singleResult.qaResult.approved ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {singleResult.qaResult.approved ? "Approved" : "Needs review"}
                    </span>
                  </p>
                </div>
                {singleResult.creative.imageUrl && (
                  <a
                    href={singleResult.creative.imageUrl}
                    download={`creative-${singleResult.creative.id}.png`}
                    className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Download
                  </a>
                )}
              </div>

              {singleResult.creative.imageUrl ? (
                <div className="p-4 bg-[var(--sf-bg-primary)] flex items-center justify-center min-h-64">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={singleResult.creative.imageUrl}
                    alt="Generated creative"
                    className="max-w-full max-h-[600px] rounded-xl shadow-lg object-contain"
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-[var(--sf-text-muted)]">Image not available</div>
              )}

              {singleResult.qaResult.feedback && (
                <div className="px-6 py-4 border-t border-[var(--sf-border)]">
                  <p className="text-xs text-[var(--sf-text-secondary)] font-medium mb-1">QA Feedback</p>
                  <p className="text-sm text-[var(--sf-text-primary)]">{singleResult.qaResult.feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Previous creatives gallery */}
          {creatives.length > 0 && !batchData && (
            <div className="bg-[var(--sf-bg-secondary)] rounded-2xl border border-[var(--sf-border)] p-6">
              <h2 className="text-sm font-semibold text-[var(--sf-text-primary)] mb-4">
                Previous Creatives ({creatives.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {creatives.map((c) => (
                  <CreativeThumbnail key={c.id} c={c} brandName={brandName} />
                ))}
              </div>
            </div>
          )}

          {creatives.length === 0 && !singleResult && !variantResults && !batchData && (
            <div className="bg-[var(--sf-bg-secondary)] rounded-lg border-2 border-dashed border-[var(--sf-border)] p-16 text-center">
              <div className="w-12 h-12 rounded-md flex items-center justify-center mx-auto mb-4" style={{ background: "var(--sf-accent-muted)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--sf-accent)" }}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
              </div>
              <h2 className="text-lg font-semibold text-[var(--sf-text-primary)] mb-2">No creatives yet</h2>
              <p className="text-sm text-[var(--sf-text-secondary)]">
                Configure the options above and hit Generate.
              </p>
            </div>
          )}
        </div>
    </div>
  );
}
