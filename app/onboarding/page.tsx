"use client";

// Onboarding flow: URL → Brand DNA → First Creative
// Target: < 3 minutes end-to-end (SPECS.md §6.2, KPI §11.1)
// BYOK: users enter their own Claude + Gemini API keys directly in this page (SPECS.md §7.3)
// UX fixes C5/M6/M7: keys expanded by default, mobile stepper, back navigation
// STA-49: demo mode — investors can complete the full flow without real API keys

import { useState } from "react";
import { Key, Sparkles, PartyPopper, CheckCircle, ThumbsUp, RefreshCw } from "lucide-react";

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
          const clickable = done;
          return (
            <div key={s} className="flex items-center gap-3">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onNavigate(s)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${active
                    ? 'text-white'
                    : done
                    ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                    : 'text-gray-400 cursor-default'
                  }`}
                style={active ? { background: 'var(--sf-accent)' } : done ? undefined : { background: 'var(--sf-bg-elevated)' }}
              >
                {done ? "✓" : i + 1}
              </button>
              <span
                className={`text-sm font-medium ${done ? "text-green-500 cursor-pointer" : ""}`}
                style={active
                  ? { color: 'var(--sf-text-primary)' }
                  : done
                  ? undefined
                  : { color: 'var(--sf-text-muted)' }
                }
                onClick={() => done && onNavigate(s)}
              >
                {STEP_LABELS[s]}
              </span>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px" style={{ background: 'var(--sf-border)' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile stepper (<640px) */}
      <div className="sm:hidden mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--sf-text-muted)' }}>
            Step {currentIdx + 1}/{STEPS.length} · {STEP_LABELS[step]}
          </span>
          {currentIdx > 0 && (
            <button
              type="button"
              onClick={() => onNavigate(STEPS[currentIdx - 1])}
              className="text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--sf-text-secondary)' }}
            >
              ← Back
            </button>
          )}
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--sf-bg-elevated)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / STEPS.length) * 100}%`, background: 'var(--sf-accent)' }}
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

  function navigateTo(s: Step) {
    setStep(s);
    if (s === "url") { setDna(null); setCreative(null); setIsDemo(false); }
    if (s === "dna") { setCreative(null); }
  }

  function handleTryDemo() {
    setIsDemo(true);
    setDna(DEMO_DNA);
    setStep("dna");
  }

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

  async function handleGenerate() {
    if (!dna) return;

    if (isDemo) {
      setGenerating(true);
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
    <main className="min-h-screen" style={{ background: 'var(--sf-bg-primary)' }}>
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center gap-3"
        style={{ borderColor: 'var(--sf-border)' }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: 'var(--sf-accent)' }}
        >
          <span className="text-white font-bold text-sm font-display">S</span>
        </div>
        <span
          className="text-lg font-bold font-display"
          style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.02em' }}
        >
          <span style={{ color: 'var(--sf-accent)' }}>S</span>taticsFlow
        </span>
        {isDemo && (
          <span className="ml-2 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,159,10,0.15)', color: 'var(--sf-warning)' }}>
            Demo mode
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <Stepper step={step} onNavigate={navigateTo} />

        {/* ── Step 1: URL + API keys ─────────────────────────────────── */}
        {step === "url" && (
          <div>
            <h1
              className="text-3xl font-bold mb-3 font-display"
              style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.02em' }}
            >
              Paste your website URL
            </h1>
            <p className="mb-8" style={{ color: 'var(--sf-text-secondary)' }}>
              We&apos;ll extract your Brand DNA automatically in ~30 seconds — colors, fonts, tone of voice, key benefits, and more.
            </p>

            <form onSubmit={handleExtract} className="space-y-4">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourstore.com"
                className="w-full px-4 py-3.5 text-lg rounded-md border focus:outline-none focus:ring-2 font-sans"
                style={{
                  background: 'var(--sf-bg-secondary)',
                  borderColor: 'var(--sf-border)',
                  color: 'var(--sf-text-primary)',
                  '--tw-ring-color': 'var(--sf-accent)',
                } as React.CSSProperties}
              />

              {/* API keys */}
              <div className="rounded-md overflow-hidden border" style={{ borderColor: 'var(--sf-border)' }}>
                <div
                  className="px-4 py-3 flex items-center gap-2 border-b"
                  style={{ background: 'var(--sf-bg-elevated)', borderColor: 'var(--sf-border)' }}
                >
                  <Key className="w-4 h-4" style={{ color: 'var(--sf-text-muted)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--sf-text-primary)' }}>Your API Keys</span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--sf-text-muted)' }}>Used only for this session — never stored</span>
                </div>
                <div className="p-4 space-y-4" style={{ background: 'var(--sf-bg-secondary)' }}>
                  {/* Claude key */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--sf-text-secondary)' }}>
                        Claude API Key <span style={{ color: 'var(--sf-error)' }}>*</span>
                      </label>
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:opacity-80"
                        style={{ color: 'var(--sf-accent)' }}
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
                      className="w-full px-3 py-2.5 text-sm rounded-md border focus:outline-none font-mono"
                      style={{
                        background: 'var(--sf-bg-elevated)',
                        borderColor: 'var(--sf-border)',
                        color: 'var(--sf-text-primary)',
                      }}
                    />
                  </div>
                  {/* Gemini key */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--sf-text-secondary)' }}>
                        Gemini API Key <span style={{ color: 'var(--sf-error)' }}>*</span>
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:opacity-80"
                        style={{ color: 'var(--sf-accent)' }}
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
                      className="w-full px-3 py-2.5 text-sm rounded-md border focus:outline-none font-mono"
                      style={{
                        background: 'var(--sf-bg-elevated)',
                        borderColor: 'var(--sf-border)',
                        color: 'var(--sf-text-primary)',
                      }}
                    />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--sf-text-muted)' }}>
                    StaticsFlow is BYOK — your keys power the AI, we never store them.
                  </p>
                </div>
              </div>

              {extractError && (
                <p
                  className="text-sm px-4 py-3 rounded-md border"
                  style={{ color: 'var(--sf-error)', background: 'rgba(255,69,58,0.1)', borderColor: 'rgba(255,69,58,0.2)' }}
                >
                  {extractError}
                </p>
              )}

              <button
                type="submit"
                disabled={extracting}
                className="w-full py-3.5 px-6 text-white font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--sf-accent)' }}
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

            {/* STA-49: Demo mode */}
            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1 h-px" style={{ background: 'var(--sf-border)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--sf-text-muted)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--sf-border)' }} />
            </div>
            <button
              type="button"
              onClick={handleTryDemo}
              className="mt-4 w-full py-3 px-6 border text-sm font-semibold rounded-md hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-text-primary)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: 'var(--sf-accent)' }} />
              Try Demo — see the full flow instantly
            </button>
            <p className="mt-2 text-xs text-center" style={{ color: 'var(--sf-text-muted)' }}>
              No API keys needed · Uses a sample fashion brand
            </p>
          </div>
        )}

        {/* ── Step 2: Brand DNA review ───────────────────────────────── */}
        {step === "dna" && dna && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-md border flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: dna.colors.primary, borderColor: 'var(--sf-border)' }}
              >
                {dna.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dna.logoUrl} alt={dna.name} className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-white font-bold text-sm">{dna.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <h2 className="font-bold" style={{ color: 'var(--sf-text-primary)' }}>{dna.name}</h2>
                <p className="text-sm" style={{ color: 'var(--sf-text-secondary)' }}>{dna.url}</p>
              </div>
              <span
                className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(52,199,89,0.15)', color: 'var(--sf-success)' }}
              >
                ✓ Brand DNA extracted
              </span>
            </div>

            <h1
              className="text-3xl font-bold mb-2 font-display"
              style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.02em' }}
            >
              Your Brand DNA is ready
            </h1>
            <p className="mb-8" style={{ color: 'var(--sf-text-secondary)' }}>
              Review and validate the extracted brand profile before generating your first creative.
            </p>

            <div className="space-y-4 mb-8">
              {/* Colors */}
              <div className="rounded-md p-5 border" style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-bg-secondary)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--sf-text-primary)' }}>Brand Colors</h3>
                <div className="flex gap-3">
                  {(["primary", "secondary", "accent"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: dna.colors[key], borderColor: 'var(--sf-border)' }} />
                      <div>
                        <div className="text-xs capitalize" style={{ color: 'var(--sf-text-muted)' }}>{key}</div>
                        <div className="text-xs font-mono" style={{ color: 'var(--sf-text-primary)' }}>{dna.colors[key]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tone & Voice */}
              <div className="rounded-md p-5 border" style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-bg-secondary)' }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--sf-text-primary)' }}>Tone of Voice</h3>
                <p className="text-sm" style={{ color: 'var(--sf-text-secondary)' }}>{dna.toneOfVoice}</p>
              </div>

              {/* Key Benefits */}
              <div className="rounded-md p-5 border" style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-bg-secondary)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--sf-text-primary)' }}>Key Benefits</h3>
                <ul className="space-y-1">
                  {dna.keyBenefits.slice(0, 3).map((benefit, i) => (
                    <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--sf-text-secondary)' }}>
                      <span className="font-bold" style={{ color: 'var(--sf-success)' }}>✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Personas */}
              {dna.personas.length > 0 && (
                <div className="rounded-md p-5 border" style={{ borderColor: 'var(--sf-border)', background: 'var(--sf-bg-secondary)' }}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--sf-text-primary)' }}>Target Personas</h3>
                  <p className="text-sm" style={{ color: 'var(--sf-text-secondary)' }}>{dna.personas[0]}</p>
                </div>
              )}
            </div>

            {/* Gemini key reminder — hidden in demo mode */}
            {!isDemo && !geminiKey && (
              <div
                className="mb-4 p-4 rounded-md border"
                style={{ background: 'rgba(255,159,10,0.1)', borderColor: 'rgba(255,159,10,0.25)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--sf-warning)' }}>
                    <Key className="w-4 h-4" />
                    Gemini API key needed
                  </p>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:opacity-80" style={{ color: 'var(--sf-warning)' }}>Get key →</a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none font-mono"
                  style={{ background: 'var(--sf-bg-elevated)', borderColor: 'var(--sf-border)', color: 'var(--sf-text-primary)' }}
                />
              </div>
            )}

            {generateError && (
              <p
                className="text-sm px-4 py-3 rounded-md border mb-4"
                style={{ color: 'var(--sf-error)', background: 'rgba(255,69,58,0.1)', borderColor: 'rgba(255,69,58,0.2)' }}
              >
                {generateError}
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3.5 px-6 text-white font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--sf-accent)' }}
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

            <button
              onClick={() => navigateTo("url")}
              className="mt-3 w-full py-2.5 text-sm hover:opacity-80"
              style={{ color: 'var(--sf-text-secondary)' }}
            >
              ← Try a different URL
            </button>
          </div>
        )}

        {/* ── Step 3: Generated creative ────────────────────────────── */}
        {step === "creative" && creative && dna && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <PartyPopper className="w-6 h-6" style={{ color: 'var(--sf-accent)' }} />
              <span className="text-lg font-bold" style={{ color: 'var(--sf-text-primary)' }}>
                Your first on-brand creative is ready!
              </span>
            </div>

            {/* Creative preview */}
            <div className="rounded-lg border overflow-hidden mb-6" style={{ borderColor: 'var(--sf-border)' }}>
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
                  <div className="w-16 h-16 rounded-md mb-4 flex items-center justify-center" style={{ backgroundColor: dna.colors.primary }}>
                    <span className="text-white font-bold text-2xl">{dna.name.charAt(0)}</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--sf-text-primary)' }}>{creative.briefJson?.headline ?? "Your Headline Here"}</h2>
                  <p className="mb-4" style={{ color: 'var(--sf-text-secondary)' }}>{creative.briefJson?.copy ?? "Your ad copy here"}</p>
                  <div className="px-6 py-2.5 rounded-md font-semibold text-sm" style={{ backgroundColor: dna.colors.accent, color: "#fff" }}>
                    {creative.briefJson?.callToAction ?? "Shop Now"}
                  </div>
                  {isDemo && (
                    <p className="mt-4 text-xs" style={{ color: 'var(--sf-text-muted)' }}>
                      Demo mode — connect your Gemini key to generate real AI images
                    </p>
                  )}
                  {!isDemo && (
                    <p className="mt-4 text-xs" style={{ color: 'var(--sf-text-muted)' }}>Configure R2 storage to see the full Gemini-generated image</p>
                  )}
                </div>
              )}
            </div>

            {/* QA score */}
            {creative.score !== null && (
              <div
                className="flex items-center gap-3 mb-6 p-4 rounded-md"
                style={{ background: 'var(--sf-bg-secondary)' }}
              >
                <div>
                  {creative.score >= 0.8
                    ? <CheckCircle className="w-6 h-6" style={{ color: 'var(--sf-success)' }} />
                    : creative.score >= 0.7
                    ? <ThumbsUp className="w-6 h-6 text-yellow-500" />
                    : <RefreshCw className="w-6 h-6 text-orange-500" />
                  }
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--sf-text-primary)' }}>
                    Brand consistency score:{" "}
                    <span style={{ color: creative.score >= 0.8 ? 'var(--sf-success)' : creative.score >= 0.7 ? '#f59e0b' : '#f97316' }}>
                      {Math.round(creative.score * 100)}%
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--sf-text-muted)' }}>
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
                    className="flex-1 py-3 px-4 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity text-center"
                    style={{ background: 'var(--sf-accent)' }}
                  >
                    Download Creative
                  </a>
                )}
              <a
                href="/signup"
                className="flex-1 py-3 px-4 border text-sm font-semibold rounded-md hover:opacity-80 transition-opacity text-center"
                style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-text-primary)' }}
              >
                Create account to save →
              </a>
            </div>

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => navigateTo("dna")}
                className="flex-1 py-2.5 text-sm hover:opacity-80"
                style={{ color: 'var(--sf-text-secondary)' }}
              >
                ← Back to Brand DNA
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-2.5 text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1"
                style={{ color: 'var(--sf-accent)' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {generating ? "Generating…" : "Generate another"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
