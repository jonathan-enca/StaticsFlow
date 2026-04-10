"use client";

// Onboarding flow: URL → Brand DNA → First Creative
// Target: < 3 minutes end-to-end (SPECS.md §6.2, KPI §11.1)
// BYOK: users enter their own Claude + Gemini API keys directly in this page (SPECS.md §7.3)
// This is the "wow moment" — if it doesn't impress, we lose the user.

import { useState } from "react";

type Step = "url" | "dna" | "creative";

interface BrandDNA {
  name: string;
  url: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: string[];
  logoUrl: string | null;
  toneOfVoice: string;
  keyBenefits: string[];
  personas: string[];
  brandVoice: string;
  productCategory: string;
}

interface GeneratedCreative {
  id: string;
  imageUrl: string | null;
  briefJson: {
    headline?: string;
    copy?: string;
    callToAction?: string;
    angle?: string;
  };
  status: string;
  score: number | null;
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showKeys, setShowKeys] = useState(false);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [dna, setDna] = useState<BrandDNA | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [creative, setCreative] = useState<GeneratedCreative | null>(null);

  // ── Step 1: Extract Brand DNA ─────────────────────────────────────────────
  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setExtractError(null);

    if (!anthropicKey.trim()) {
      setExtractError("Your Claude API key is required to extract Brand DNA.");
      setShowKeys(true);
      return;
    }

    setExtracting(true);

    const res = await fetch("/api/brands/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, anthropicApiKey: anthropicKey.trim() }),
    });

    setExtracting(false);

    if (!res.ok) {
      const data = await res.json();
      setExtractError(data.error ?? "Extraction failed. Please check the URL and try again.");
      return;
    }

    const data = await res.json();
    setDna(data.dna);
    setStep("dna");
  }

  // ── Step 2: Generate first creative from validated Brand DNA ──────────────
  async function handleGenerate() {
    if (!dna) return;

    if (!geminiKey.trim()) {
      setGenerateError("Your Gemini API key is required to generate the creative.");
      setShowKeys(true);
      return;
    }

    setGenerateError(null);
    setGenerating(true);

    const res = await fetch("/api/onboarding/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dna,
        anthropicApiKey: anthropicKey.trim(),
        geminiApiKey: geminiKey.trim(),
        format: "1080x1080",
        angle: "benefit",
      }),
    });

    setGenerating(false);

    if (!res.ok) {
      const data = await res.json();
      setGenerateError(data.error ?? "Generation failed. Please try again.");
      return;
    }

    const data = await res.json();
    setCreative(data.creative);
    setStep("creative");
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
        <span className="text-lg font-bold text-gray-900">StaticsFlow</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 mb-10">
          {(["url", "dna", "creative"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step === s
                    ? "bg-black text-white"
                    : ["url", "dna", "creative"].indexOf(step) > i
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {["url", "dna", "creative"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  step === s ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {s === "url" ? "Enter URL" : s === "dna" ? "Brand DNA" : "First Creative"}
              </span>
              {i < 2 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: URL + API keys ─────────────────────────────────── */}
        {step === "url" && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Paste your website URL
            </h1>
            <p className="text-gray-500 mb-8">
              We&apos;ll extract your Brand DNA automatically in ~30 seconds — colors, fonts, tone of voice, key benefits, and more.
            </p>

            <form onSubmit={handleExtract} className="space-y-4">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourstore.com"
                className="w-full px-4 py-3.5 text-lg rounded-xl border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />

              {/* API keys — required for BYOK model */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowKeys(!showKeys)}
                  className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">🔑</span>
                    Your API Keys
                    {(!anthropicKey || !geminiKey) && (
                      <span className="text-xs font-normal px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                        Required
                      </span>
                    )}
                    {anthropicKey && geminiKey && (
                      <span className="text-xs font-normal px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        ✓ Set
                      </span>
                    )}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${showKeys ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showKeys && (
                  <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-3">
                      StaticsFlow uses your own API keys. They are never stored — only used for this session.
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Claude API Key (Anthropic)
                      </label>
                      <input
                        type="password"
                        value={anthropicKey}
                        onChange={(e) => setAnthropicKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white font-mono"
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Get it at{" "}
                        <span className="font-medium text-gray-600">console.anthropic.com</span>
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Gemini API Key (Google)
                      </label>
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white font-mono"
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Get it at{" "}
                        <span className="font-medium text-gray-600">aistudio.google.com</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {extractError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                  {extractError}
                </p>
              )}

              <button
                type="submit"
                disabled={extracting}
                onClick={() => { if (!showKeys && !anthropicKey) setShowKeys(true); }}
                className="w-full py-3.5 px-6 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {extracting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Extracting Brand DNA… (~30s)
                  </>
                ) : (
                  "Extract Brand DNA →"
                )}
              </button>
            </form>

            <p className="mt-6 text-sm text-gray-400 text-center">
              Works best with e-commerce and DTC brand websites
            </p>
          </div>
        )}

        {/* ── Step 2: Brand DNA review ───────────────────────────────── */}
        {step === "dna" && dna && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: dna.colors.primary }}
              >
                {dna.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dna.logoUrl} alt={dna.name} className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {dna.name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{dna.name}</h2>
                <p className="text-sm text-gray-500">{dna.url}</p>
              </div>
              <span className="ml-auto text-xs font-medium px-2.5 py-1 bg-green-100 text-green-700 rounded-full">
                ✓ Brand DNA extracted
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Brand DNA is ready
            </h1>
            <p className="text-gray-500 mb-8">
              Review and validate the extracted brand profile before generating your first creative.
            </p>

            {/* DNA summary cards */}
            <div className="space-y-4 mb-8">
              {/* Colors */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Brand Colors</h3>
                <div className="flex gap-3">
                  {[
                    { label: "Primary", color: dna.colors.primary },
                    { label: "Secondary", color: dna.colors.secondary },
                    { label: "Accent", color: dna.colors.accent },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg border border-gray-200"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="text-xs font-mono text-gray-900">{color}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tone & Voice */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Tone of Voice</h3>
                <p className="text-sm text-gray-600">{dna.toneOfVoice}</p>
              </div>

              {/* Key Benefits */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Benefits</h3>
                <ul className="space-y-1">
                  {dna.keyBenefits.slice(0, 3).map((benefit, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Personas */}
              {dna.personas.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Target Personas</h3>
                  <p className="text-sm text-gray-600">{dna.personas[0]}</p>
                </div>
              )}
            </div>

            {/* Gemini key reminder if missing */}
            {!geminiKey && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-semibold text-amber-800 mb-2">🔑 Gemini API key needed to generate your creative</p>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white font-mono"
                />
                <p className="mt-1 text-xs text-amber-600">Get it at aistudio.google.com</p>
              </div>
            )}

            {generateError && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg mb-4">
                {generateError}
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3.5 px-6 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating your first ad… (~30s)
                </>
              ) : (
                "Generate First Ad Creative →"
              )}
            </button>

            <button
              onClick={() => setStep("url")}
              className="mt-3 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700"
            >
              ← Try a different URL
            </button>
          </div>
        )}

        {/* ── Step 3: Generated creative ────────────────────────────── */}
        {step === "creative" && creative && dna && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🎉</span>
              <span className="text-lg font-bold text-gray-900">
                Your first on-brand creative is ready!
              </span>
            </div>

            {/* Creative preview */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden mb-6">
              {creative.imageUrl && creative.imageUrl.startsWith("data:image/png;base64,") && creative.imageUrl.length > 100 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creative.imageUrl}
                  alt="Generated ad creative"
                  className="w-full aspect-square object-cover"
                />
              ) : creative.imageUrl && !creative.imageUrl.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creative.imageUrl}
                  alt="Generated ad creative"
                  className="w-full aspect-square object-cover"
                />
              ) : (
                /* Placeholder: show the brief copy in brand colors */
                <div
                  className="w-full aspect-square flex flex-col items-center justify-center p-8 text-center"
                  style={{ backgroundColor: dna.colors.primary + "20" }}
                >
                  <div
                    className="w-16 h-16 rounded-xl mb-4 flex items-center justify-center"
                    style={{ backgroundColor: dna.colors.primary }}
                  >
                    <span className="text-white font-bold text-2xl">
                      {dna.name.charAt(0)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {creative.briefJson?.headline ?? "Your Headline Here"}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {creative.briefJson?.copy ?? "Your ad copy here"}
                  </p>
                  <div
                    className="px-6 py-2.5 rounded-lg font-semibold text-sm"
                    style={{
                      backgroundColor: dna.colors.accent,
                      color: "#fff",
                    }}
                  >
                    {creative.briefJson?.callToAction ?? "Shop Now"}
                  </div>
                  <p className="mt-4 text-xs text-gray-400">
                    Configure R2 storage to see the full Gemini-generated image
                  </p>
                </div>
              )}
            </div>

            {/* QA score */}
            {creative.score !== null && (
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl">
                  {creative.score >= 0.8
                    ? "✅"
                    : creative.score >= 0.7
                    ? "👍"
                    : "🔄"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Brand consistency score:{" "}
                    <span
                      className={
                        creative.score >= 0.8
                          ? "text-green-600"
                          : creative.score >= 0.7
                          ? "text-yellow-600"
                          : "text-orange-600"
                      }
                    >
                      {Math.round(creative.score * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Claude QA review — {creative.score >= 0.7 ? "approved" : "review recommended"}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {creative.imageUrl &&
                creative.imageUrl.startsWith("data:image/png;base64,") &&
                creative.imageUrl.length > 100 && (
                  <a
                    href={creative.imageUrl}
                    download="staticsflow-creative.png"
                    className="flex-1 py-3 px-4 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors text-center"
                  >
                    Download Creative
                  </a>
                )}
              <a
                href="/signup"
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors text-center"
              >
                Create account to save →
              </a>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-3 w-full py-2.5 text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
            >
              {generating ? "Generating…" : "↺ Generate another creative"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
