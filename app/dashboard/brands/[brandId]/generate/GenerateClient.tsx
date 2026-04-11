"use client";

// Creative generation UI
// Lets the user pick format + angle, triggers generation, shows results

import { useState } from "react";
import type { AdFormat, CreativeAngle } from "@/types/index";

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

const ANGLE_OPTIONS: { value: CreativeAngle; label: string; desc: string }[] = [
  { value: "benefit", label: "Benefit", desc: "Lead with the product's core value" },
  { value: "pain", label: "Pain", desc: "Address the customer's problem" },
  { value: "social_proof", label: "Social Proof", desc: "Leverage customer love" },
  { value: "curiosity", label: "Curiosity", desc: "Create intrigue" },
  { value: "fomo", label: "FOMO", desc: "Fear of missing out" },
  { value: "authority", label: "Authority", desc: "Expert credibility" },
  { value: "urgency", label: "Urgency", desc: "Time-sensitive offer" },
];

interface GenerateResult {
  creative: ExistingCreative;
  qaResult: {
    approved: boolean;
    score: number;
    feedback: string;
    iterations: number;
  };
}

export default function GenerateClient({ brandId, brandName, existingCreatives }: Props) {
  const [format, setFormat] = useState<AdFormat>("1080x1080");
  const [angle, setAngle] = useState<CreativeAngle>("benefit");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [creatives, setCreatives] = useState<ExistingCreative[]>(existingCreatives);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, format, angle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      const newCreative: ExistingCreative = {
        id: data.creative.id,
        imageUrl: data.creative.imageUrl,
        status: data.creative.status,
        score: data.creative.score,
        format: data.creative.format,
        angle: data.creative.angle,
        createdAt: data.creative.createdAt,
      };

      setResult({ creative: newCreative, qaResult: data.qaResult });
      setCreatives((prev) => [newCreative, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-1">
          <a href="/dashboard" className="hover:underline">Dashboard</a>
          {" / "}
          <a href={`/dashboard/brands/${brandId}`} className="hover:underline">Brand DNA</a>
          {" / "}Generate
        </p>
        <h1 className="text-2xl font-bold text-gray-900">{brandName} — Generate Creative</h1>
        <p className="text-sm text-gray-500 mt-1">
          Claude writes the brief · Gemini generates the image · Claude QA reviews
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Format picker */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Ad Format</h2>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                    format === f.value
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  <span className="font-medium">{f.label}</span>
                  <span className={format === f.value ? "text-gray-300" : "text-gray-400"}>{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Angle picker */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Creative Angle</h2>
            <div className="space-y-2">
              {ANGLE_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAngle(a.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                    angle === a.value
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  <span className="font-medium">{a.label}</span>
                  <span className={angle === a.value ? "text-gray-300" : "text-gray-400 text-xs"}>{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
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
                Generating…
              </span>
            ) : (
              "Generate Creative →"
            )}
          </button>

          {generating && (
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>Claude is writing the creative brief…</p>
              <p>Gemini is generating the image…</p>
              <p>Claude QA is reviewing the result…</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Right: Result + history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Latest result */}
          {result && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Generated Creative</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {result.qaResult.iterations} QA iteration{result.qaResult.iterations !== 1 ? "s" : ""}
                    {" · "}Score: {Math.round(result.qaResult.score * 100)}%
                    {" · "}
                    <span className={result.qaResult.approved ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {result.qaResult.approved ? "Approved" : "Needs review"}
                    </span>
                  </p>
                </div>
                {result.creative.imageUrl && (
                  <a
                    href={result.creative.imageUrl}
                    download={`creative-${result.creative.id}.png`}
                    className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Download
                  </a>
                )}
              </div>

              {result.creative.imageUrl ? (
                <div className="p-4 bg-gray-50 flex items-center justify-center min-h-64">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.creative.imageUrl}
                    alt="Generated creative"
                    className="max-w-full max-h-[600px] rounded-xl shadow-lg object-contain"
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-gray-400">Image not available</div>
              )}

              {result.qaResult.feedback && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-1">QA Feedback</p>
                  <p className="text-sm text-gray-700">{result.qaResult.feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Previous creatives */}
          {creatives.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Previous Creatives ({creatives.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {creatives.map((c) => (
                  <div key={c.id} className="space-y-2">
                    <div className="rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50 flex items-center justify-center">
                      {c.imageUrl && !c.imageUrl.startsWith("data:image/png;base64,data") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">
                          {c.status === "GENERATING" ? "Generating…" : "No preview"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      <span className={`inline-block px-2 py-0.5 rounded-full ${
                        c.status === "APPROVED"
                          ? "bg-green-50 text-green-700"
                          : c.status === "REJECTED"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {c.status}
                      </span>
                      {c.score != null && (
                        <span className="ml-1">{Math.round(c.score * 100)}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {creatives.length === 0 && !result && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎨</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No creatives yet</h2>
              <p className="text-sm text-gray-500">
                Pick a format and angle, then hit Generate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
