"use client";

// Onboarding flow: URL → Brand DNA → First Creative
// Target: < 3 minutes end-to-end (SPECS.md §6.2, KPI §11.1)
// BYOK: users enter their own Claude + Gemini API keys directly in this page (SPECS.md §7.3)
// UX fixes C5/M6/M7: keys expanded by default, mobile stepper, back navigation
// STA-49: demo mode — investors can complete the full flow without real API keys

import { useState } from "react";

type Step = "url" | "dna" | "creative";
const STEPS: Step[] = ["url", "dna", "creative"];
const STEP_LABELS: Record<Step, string> = { url: "Enter URL", dna: "Brand DNA", creative: "First Creative" };

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

// ── Demo data — hardcoded for investor meeting (STA-49) ──────────────────────
const DEMO_DNA: BrandDNA = {
  name: "Lumière Paris",
  url: "https://lumiere-paris.com",
  colors: { primary: "#1A1A2E", secondary: "#F5F0EB", accent: "#C9A84C" },
  fonts: ["Playfair Display", "Inter"],
  logoUrl: null,
  toneOfVoice:
    "Sophisticated, aspirational, and warm. We speak to women who know what they want — timeless elegance, not fleeting trends.",
  keyBenefits: [
    "Ethically sourced fabrics from Normandy — luxury with a conscience",
    "Designed in Paris, made to last a lifetime (not a season)",
    "Free express delivery + hassle-free returns within 60 days",
  ],
  personas: [
    "Urban professional woman, 28–45, values quality over quantity, builds a capsule wardrobe intentionally",
  ],
  brandVoice: "Refined, direct, poetic. Think Coco Chanel meets Glossier.",
  productCategory: "Premium Fashion / DTC",
};

const DEMO_CREATIVE: GeneratedCreative = {
  id: "demo-creative-001",
  imageUrl: null,
  briefJson: {
    headline: "Wear Less. Mean More.",
    copy: "Crafted in Normandy. Designed in Paris. Built for the woman who has everything — except time to waste.",
    callToAction: "Shop the Collection",
    angle: "Aspiration & Identity",
  },
  status: "approved",
  score: 0.92,
};

// ── Progress stepper ──────────────────────────────────────────────────────────
function Stepper({ step, onNavigate }: { step: Step; onNavigate: (s: Step) => void }) {
  const currentIdx = STEPS.indexOf(step);

  return (
    <>
      {/* Desktop stepper (≥640px) */}
      <div className="hidden sm:flex items-center gap-3 mb-10">
        {STEPS.map((s, i) => {
          const done = currentIdx > i;
          const active = step === s;
          const clickable = done; // can only go back to completed steps
          return (
            <div key={s} className="flex items-center gap-3">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onNavigate(s)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${active ? "bg-black text-white" : done ? "bg-green-500 text-white cursor-pointer hover:bg-green-600" : "bg-gray-100 text-gray-400 cursor-default"}`}
              >
                {done ? "✓" : i + 1}
              </button>
              <span className={`text-sm font-medium ${active ? "text-gray-900" : done ? "text-green-600 cursor-pointer" : "text-gray-400"}`}
                onClick={() => done && onNavigate(s)}
              >
                {STEP_LABELS[s]}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          );
        })}
      </div>

      {/* Mobile stepper (<640px): "Step 2/3 · Brand DNA" + progress bar */}
      <div className="sm:hidden mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Step {currentIdx + 1}/{STEPS.length} · {STEP_LABELS[step]}
          </span>
          {currentIdx > 0 && (
            <button
              type="button"
              onClick={() => onNavigate(STEPS[currentIdx - 1])}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Back
            </button>
          )}
        </div>
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-black rounded-full transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  // C5: keys expanded by default — no friction
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [dna, setDna] = useState<BrandDNA | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [creative, setCreative] = useState<GeneratedCreative | null>(null);

  // STA-49: demo mode flag — skips all API calls
  const [isDemo, setIsDemo] = useState(false);

  // M7: navigate back to a completed step (clears subsequent data)
  function navigateTo(s: Step) {
    setStep(s);
    if (s === "url") { setDna(null); setCreative(null); setIsDemo(false); }
    if (s === "dna") { setCreative(null); }
  }

  // STA-49: activate demo mode — load hardcoded Brand DNA instantly, no API call
  function handleTryDemo() {
    setIsDemo(true);
    setDna(DEMO_DNA);
    setStep("dna");
  }

  // ── Step 1: Extract Brand DNA ─────────────────────────────────────────────
  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setExtractError(null);

    if (!anthropicKey.trim()) {
      setExtractError("Your Claude API key is required to extract Brand DNA.");
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

  // ── Step 2: Generate first creative ──────────────────────────────────────
  async function handleGenerate() {
    if (!dna) return;

    // STA-49: demo mode — load hardcoded creative instantly, no Gemini call
    if (isDemo) {
      setGenerating(true);
      // Simulate a brief generation delay for UX realism
      await new Promise((r) => setTimeout(r, 1200));
      setGenerating(false);
      setCreative(DEMO_CREATIVE);
      setStep("creative");
      return;
    }

    if (!geminiKey.trim()) {
      setGenerateError("Your Gemini API key is required to generate the creative.");
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
        {isDemo && (
          <span className="ml-2 text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
            Demo mode
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <Stepper step={step} onNavigate={navigateTo} />

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

              {/* C5: API keys expanded by default */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-base">🔑</span>
                  <span className="text-sm font-semibold text-gray-700">Your API Keys</span>
                  <span className="ml-auto text-xs text-gray-400">Used only for this session — never stored</span>
                </div>
                <div className="p-4 space-y-4 bg-white">
                  {/* Claude key */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-600">
                        Claude API Key <span className="text-red-400">*</span>
                      </label>
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Get key →
                      </a>
                    </div>
                    <input
                      type="password"
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                      autoComplete="off"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-mono"
                    />
                  </div>
                  {/* Gemini key */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-600">
                        Gemini API Key <span className="text-red-400">*</span>
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Get key →
                      </a>
                    </div>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIza..."
                      autoComplete="off"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-mono"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    StaticsFlow is BYOK — your keys power the AI, we never store them.
                  </p>
                </div>
              </div>

              {extractError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                  {extractError}
                </p>
              )}

              <button
                type="submit"
                disabled={extracting}
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

            {/* STA-49: Demo mode divider + button */}
            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <button
              type="button"
              onClick={handleTryDemo}
              className="mt-4 w-full py-3 px-6 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <span>✨</span>
              Try Demo — see the full flow instantly
            </button>
            <p className="mt-2 text-xs text-gray-400 text-center">
              No API keys needed · Uses a sample fashion brand
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
                  <span className="text-white font-bold text-sm">{dna.name.charAt(0)}</span>
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

            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Brand DNA is ready</h1>
            <p className="text-gray-500 mb-8">
              Review and validate the extracted brand profile before generating your first creative.
            </p>

            <div className="space-y-4 mb-8">
              {/* Colors */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Brand Colors</h3>
                <div className="flex gap-3">
                  {(["primary", "secondary", "accent"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ backgroundColor: dna.colors[key] }} />
                      <div>
                        <div className="text-xs text-gray-500 capitalize">{key}</div>
                        <div className="text-xs font-mono text-gray-900">{dna.colors[key]}</div>
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

            {/* Gemini key reminder — hidden in demo mode */}
            {!isDemo && !geminiKey && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-amber-800">🔑 Gemini API key needed</p>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 font-medium hover:underline">Get key →</a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white font-mono"
                />
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
                  {isDemo ? "Generating demo creative…" : "Generating your first ad… (~30s)"}
                </>
              ) : (
                "Generate First Ad Creative →"
              )}
            </button>

            <button onClick={() => navigateTo("url")} className="mt-3 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700">
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
              {creative.imageUrl &&
              creative.imageUrl.startsWith("data:image/png;base64,") &&
              creative.imageUrl.length > 100 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creative.imageUrl} alt="Generated ad creative" className="w-full aspect-square object-cover" />
              ) : creative.imageUrl && !creative.imageUrl.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creative.imageUrl} alt="Generated ad creative" className="w-full aspect-square object-cover" />
              ) : (
                <div
                  className="w-full aspect-square flex flex-col items-center justify-center p-8 text-center"
                  style={{ backgroundColor: dna.colors.primary + "20" }}
                >
                  <div className="w-16 h-16 rounded-xl mb-4 flex items-center justify-center" style={{ backgroundColor: dna.colors.primary }}>
                    <span className="text-white font-bold text-2xl">{dna.name.charAt(0)}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{creative.briefJson?.headline ?? "Your Headline Here"}</h2>
                  <p className="text-gray-600 mb-4">{creative.briefJson?.copy ?? "Your ad copy here"}</p>
                  <div className="px-6 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: dna.colors.accent, color: "#fff" }}>
                    {creative.briefJson?.callToAction ?? "Shop Now"}
                  </div>
                  {isDemo && (
                    <p className="mt-4 text-xs text-gray-400">
                      Demo mode — connect your Gemini key to generate real AI images
                    </p>
                  )}
                  {!isDemo && (
                    <p className="mt-4 text-xs text-gray-400">Configure R2 storage to see the full Gemini-generated image</p>
                  )}
                </div>
              )}
            </div>

            {/* QA score */}
            {creative.score !== null && (
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl">
                  {creative.score >= 0.8 ? "✅" : creative.score >= 0.7 ? "👍" : "🔄"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Brand consistency score:{" "}
                    <span className={creative.score >= 0.8 ? "text-green-600" : creative.score >= 0.7 ? "text-yellow-600" : "text-orange-600"}>
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

            {/* M7: back navigation from step 3 */}
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => navigateTo("dna")}
                className="flex-1 py-2.5 text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to Brand DNA
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-2.5 text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
              >
                {generating ? "Generating…" : "↺ Generate another"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
