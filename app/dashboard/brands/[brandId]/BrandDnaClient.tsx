"use client";

// Brand DNA Enrichment UI — auto-extracted + manual enrichment
// STA-55: complete senior creative strategist fields + full editability
// Layout: grouped sections covering all Brand DNA dimensions

import { useState, useRef } from "react";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { Persona, CommunicationAngles, CustomAsset } from "@/types/index";

const BRAND_ARCHETYPES = ["Hero", "Outlaw", "Sage", "Lover", "Jester", "Innocent", "Creator", "Caregiver", "Ruler", "Explorer", "Magician", "Regular"] as const;
const PRICE_POSITIONS = ["budget", "mid-range", "premium", "ultra-premium"] as const;
const HOOK_OPTIONS = ["pain", "curiosite", "social_proof", "fomo", "benefice_direct", "autorite", "urgence"] as const;
const CAMPAIGN_OBJECTIVES = ["awareness", "consideration", "conversion", "retention"] as const;

interface Props {
  brandId: string;
  initialDna: ExtractedBrandDNA;
  brandName: string;
}

// ── Shared: Tag input ─────────────────────────────────────────────────────────
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
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--sf-bg-elevated)] rounded-full text-sm"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-[var(--sf-text-muted)] hover:text-[var(--sf-text-secondary)] leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 text-sm bg-[var(--sf-bg-elevated)] hover:bg-[var(--sf-bg-elevated)] rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Shared: Section card ──────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
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

// ── Shared: URL image gallery (editable list of image URLs) ───────────────────
function ImageGallery({
  label,
  urls,
  onChange,
}: {
  label: string;
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addUrl = () => {
    const val = input.trim();
    if (val && !urls.includes(val)) onChange([...urls, val]);
    setInput("");
  };

  const removeUrl = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--sf-text-primary)]">{label}</label>
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-[var(--sf-bg-elevated)] border border-[var(--sf-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
      <div className="flex gap-2">
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
          placeholder="https://..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
        />
        <button type="button" onClick={addUrl} className="px-3 py-2 text-sm bg-[var(--sf-bg-elevated)] hover:bg-[var(--sf-bg-elevated)] rounded-lg font-medium transition-colors">
          Add
        </button>
      </div>
    </div>
  );
}

// ── Shared: Checkbox pill group ───────────────────────────────────────────────
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
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else if (!max || selected.length < max) {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--sf-text-primary)]">{label}{max ? ` (max ${max})` : ""}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              selected.includes(opt)
                ? "bg-black text-white border-black"
                : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)] hover:border-[var(--sf-border)]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section group header ──────────────────────────────────────────────────────
function GroupHeader({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h2 className="text-lg font-bold text-[var(--sf-text-primary)]">{label}</h2>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sf-accent-muted)', color: 'var(--sf-accent)' }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BrandDnaClient({ brandId, initialDna, brandName }: Props) {
  const [dna, setDna] = useState<ExtractedBrandDNA>(initialDna);

  // ── Save state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Visuals & Identity ──────────────────────────────────────────────────────
  const [colors, setColors] = useState(dna.colors);
  const [fonts, setFonts] = useState<string[]>(dna.fonts ?? []);
  const [logoUrl, setLogoUrl] = useState(dna.logoUrl ?? "");
  const [productImages, setProductImages] = useState<string[]>(dna.productImages ?? []);
  const [lifestyleImages, setLifestyleImages] = useState<string[]>(dna.lifestyleImages ?? []);

  // ── Identity & Positioning ──────────────────────────────────────────────────
  const [brandArchetype, setBrandArchetype] = useState<typeof BRAND_ARCHETYPES[number] | "">(
    (dna.brandArchetype as typeof BRAND_ARCHETYPES[number]) ?? ""
  );
  const [pricePositioning, setPricePositioning] = useState<typeof PRICE_POSITIONS[number] | "">(
    (dna.pricePositioning as typeof PRICE_POSITIONS[number]) ?? ""
  );
  const [targetMarkets, setTargetMarkets] = useState<string[]>(dna.targetMarkets ?? []);
  const [competitorBrands, setCompetitorBrands] = useState<string[]>(dna.competitorBrands ?? []);
  const [differentiators, setDifferentiators] = useState<string[]>(dna.differentiators ?? []);
  const [productCategory, setProductCategory] = useState(dna.productCategory ?? "");
  const [keyBenefits, setKeyBenefits] = useState<string[]>(dna.keyBenefits ?? []);
  const [personas, setPersonas] = useState<string[]>(dna.personas ?? []);

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
  const [moodboardUrls, setMoodboardUrls] = useState<string[]>(dna.moodboardUrls ?? []);
  const [creativeDoList, setCreativeDoList] = useState<string[]>(dna.creativeDoList ?? []);
  const [creativeDontList, setCreativeDontList] = useState<string[]>(dna.creativeDontList ?? []);
  const [preferredHooks, setPreferredHooks] = useState<Array<typeof HOOK_OPTIONS[number]>>(
    (dna.preferredHooks ?? []) as Array<typeof HOOK_OPTIONS[number]>
  );
  const [avoidedHooks, setAvoidedHooks] = useState<string[]>(dna.avoidedHooks ?? []);
  const [referenceAdUrls, setReferenceAdUrls] = useState<string[]>(dna.referenceAdUrls ?? []);

  // ── Customer Intelligence ───────────────────────────────────────────────────
  const [customerReviewsVerbatim, setCustomerReviewsVerbatim] = useState<string[]>(dna.customerReviewsVerbatim ?? []);
  const [customerPainPoints, setCustomerPainPoints] = useState<string[]>(dna.customerPainPoints ?? []);
  const [customerDesiredOutcome, setCustomerDesiredOutcome] = useState(dna.customerDesiredOutcome ?? "");
  const [customerObjections, setCustomerObjections] = useState<string[]>(dna.customerObjections ?? []);

  // ── Campaign Context ────────────────────────────────────────────────────────
  const [currentCampaignObjective, setCurrentCampaignObjective] = useState<typeof CAMPAIGN_OBJECTIVES[number] | "">(
    (dna.currentCampaignObjective as typeof CAMPAIGN_OBJECTIVES[number]) ?? ""
  );
  const [currentPromotion, setCurrentPromotion] = useState(dna.currentPromotion ?? "");
  const [seasonalConstraints, setSeasonalConstraints] = useState<string[]>(dna.seasonalConstraints ?? []);
  const [legalConstraints, setLegalConstraints] = useState<string[]>(dna.legalConstraints ?? []);
  const [campaignOpen, setCampaignOpen] = useState(false);

  // ── Manual enrichment (Phase 2 legacy) ─────────────────────────────────────
  const [reviewsUrl, setReviewsUrl] = useState(dna.reviewsUrl ?? "");
  const [extractingReviews, setExtractingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [assets, setAssets] = useState<CustomAsset[]>(dna.customAssets ?? []);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<"packshot" | "studio" | "ugc" | "other">("packshot");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brandBrief, setBrandBrief] = useState(dna.brandBrief ?? "");
  const [structuredPersonas, setStructuredPersonas] = useState<Persona[]>(dna.structuredPersonas ?? []);
  const [preferredAngles, setPreferredAngles] = useState<string[]>(dna.communicationAngles?.preferred ?? []);
  const [forbiddenAngles, setForbiddenAngles] = useState<string[]>(dna.communicationAngles?.forbidden ?? []);

  // ── Persona helpers ─────────────────────────────────────────────────────────
  const addPersona = () =>
    setStructuredPersonas((prev) => [
      ...prev,
      { name: "", ageRange: "", painPoints: [], aspirations: [], description: "" },
    ]);
  const updatePersona = (i: number, patch: Partial<Persona>) =>
    setStructuredPersonas((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePersona = (i: number) =>
    setStructuredPersonas((prev) => prev.filter((_, idx) => idx !== i));

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
          // Visuals & Identity
          colors,
          fonts,
          logoUrl: logoUrl || null,
          productImages,
          lifestyleImages,
          // Identity & Positioning
          brandArchetype: brandArchetype || undefined,
          pricePositioning: pricePositioning || undefined,
          targetMarkets,
          competitorBrands,
          differentiators,
          productCategory,
          keyBenefits,
          personas,
          // Voice & Messaging
          toneOfVoice,
          brandVoice,
          brandVoiceAdjectives,
          forbiddenWords,
          mandatoryMentions,
          requiredWording,
          messagingHierarchy,
          callToActionExamples,
          // Creative Direction
          visualStyleKeywords,
          moodboardUrls,
          creativeDoList,
          creativeDontList,
          preferredHooks,
          avoidedHooks,
          referenceAdUrls,
          // Customer Intelligence
          customerReviewsVerbatim,
          customerPainPoints,
          customerDesiredOutcome: customerDesiredOutcome || undefined,
          customerObjections,
          // Campaign Context
          currentCampaignObjective: currentCampaignObjective || undefined,
          currentPromotion: currentPromotion || undefined,
          seasonalConstraints,
          legalConstraints,
          // Manual enrichment
          brandBrief,
          structuredPersonas,
          communicationAngles: { preferred: preferredAngles, forbidden: forbiddenAngles } as CommunicationAngles,
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

  // ── Upload asset ────────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    setUploadingAsset(true);
    setAssetError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", assetType);
      const res = await fetch(`/api/brands/${brandId}/assets`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAssets((prev) => [...prev, data.asset as CustomAsset]);
    } catch (err) {
      setAssetError((err as Error).message);
    } finally {
      setUploadingAsset(false);
    }
  };

  const SaveButton = () => (
    <button
      type="button"
      onClick={saveAll}
      disabled={saving}
      className="px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
    >
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
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {saveError}
        </div>
      )}

      <div className="space-y-10">

        {/* ══ GROUP 1: Visuals & Identity ════════════════════════════════ */}
        <div className="space-y-6">
          <GroupHeader label="Visuals & Identity" badge="Auto-extracted · Editable" />

          {/* Colors */}
          <Section title="Brand Colors" subtitle="Edit directly — applied to all future creatives.">
            <div className="space-y-3">
              {(["primary", "secondary", "accent"] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-24 text-sm font-medium text-[var(--sf-text-primary)] capitalize">{key}</label>
                  <div className="relative">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-[var(--sf-border)] cursor-pointer p-0.5 bg-[var(--sf-bg-secondary)]"
                    />
                  </div>
                  <input
                    type="text"
                    value={colors[key]}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        setColors((prev) => ({ ...prev, [key]: val }));
                      }
                    }}
                    className="w-28 px-3 py-2 text-sm font-mono border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
                    placeholder="#000000"
                    maxLength={7}
                  />
                  <div
                    className="flex-1 h-8 rounded-lg border border-[var(--sf-border)]"
                    style={{ backgroundColor: colors[key] }}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* Logo */}
          <Section title="Logo" subtitle="URL of the brand logo. Used in ad templates.">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <div className="w-12 h-12 rounded-lg border border-[var(--sf-border)] bg-[var(--sf-bg-primary)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
              />
            </div>
          </Section>

          {/* Fonts */}
          <Section title="Fonts" subtitle="Brand typefaces. Used for guidance in Gemini prompts.">
            <TagInput label="Font names" tags={fonts} onChange={setFonts} placeholder="e.g. Inter, Playfair Display…" />
          </Section>

          {/* Product images */}
          <Section title="Product Images" subtitle="Packshots and product photos.">
            <ImageGallery label="Product image URLs" urls={productImages} onChange={setProductImages} />
          </Section>

          {/* Lifestyle images */}
          <Section title="Lifestyle Images" subtitle="Editorial and lifestyle photos from the brand website.">
            <ImageGallery label="Lifestyle image URLs" urls={lifestyleImages} onChange={setLifestyleImages} />
          </Section>
        </div>

        {/* ══ GROUP 2: Identity & Positioning ════════════════════════════ */}
        <div className="space-y-6">
          <GroupHeader label="Identity & Positioning" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Brand Archetype" subtitle="The personality archetype that best fits this brand.">
              <div className="flex flex-wrap gap-2">
                {BRAND_ARCHETYPES.map((arch) => (
                  <button
                    key={arch}
                    type="button"
                    onClick={() => setBrandArchetype(brandArchetype === arch ? "" : arch)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      brandArchetype === arch
                        ? "bg-black text-white border-black"
                        : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)] hover:border-[var(--sf-border)]"
                    }`}
                  >
                    {arch}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Price Positioning" subtitle="Where this brand sits in the market.">
              <div className="flex flex-wrap gap-2">
                {PRICE_POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPricePositioning(pricePositioning === pos ? "" : pos)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors capitalize ${
                      pricePositioning === pos
                        ? "bg-black text-white border-black"
                        : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)] hover:border-[var(--sf-border)]"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Target Markets" subtitle="Countries or regions this brand targets.">
              <TagInput label="Markets" tags={targetMarkets} onChange={setTargetMarkets} placeholder="e.g. France, US, Europe…" />
            </Section>

            <Section title="Competitor Brands" subtitle="Direct competitors to be aware of.">
              <TagInput label="Competitors" tags={competitorBrands} onChange={setCompetitorBrands} placeholder="e.g. L'Oréal, Sephora…" />
            </Section>
          </div>

          <Section title="Differentiators" subtitle="What makes this brand unique vs. competitors — be specific.">
            <TagInput label="Differentiators" tags={differentiators} onChange={setDifferentiators} placeholder="e.g. ethically sourced, made in France…" />
          </Section>

          <Section title="Product Category">
            <input
              type="text"
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              placeholder="e.g. skincare, fashion, food…"
              className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
            />
          </Section>

          <Section title="Key Benefits" subtitle="Core product benefits used in ad copy.">
            <TagInput label="Benefits" tags={keyBenefits} onChange={setKeyBenefits} placeholder="e.g. 100% natural, dermatologist-tested…" />
          </Section>

          <Section title="Target Personas" subtitle="Simple persona descriptions (one per tag).">
            <TagInput label="Personas" tags={personas} onChange={setPersonas} placeholder="e.g. Women 28-40, urban, health-conscious…" />
          </Section>
        </div>

        {/* ══ GROUP 3: Voice & Messaging ══════════════════════════════════ */}
        <div className="space-y-6">
          <GroupHeader label="Voice & Messaging" />

          <Section title="Tone of Voice" subtitle="How the brand communicates. Injected into every Claude brief.">
            <textarea
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              rows={3}
              placeholder="Casual and warm, uses tutoiement, emphasis on community and authenticity…"
              className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none"
            />
          </Section>

          <Section title="Brand Voice" subtitle="What makes this brand's communication unique.">
            <textarea
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              rows={3}
              placeholder="2-3 sentences describing what makes this brand's voice unique…"
              className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none"
            />
          </Section>

          <Section title="Voice Adjectives" subtitle="Up to 6 adjectives that define the brand voice (e.g. bold, playful, trustworthy).">
            <TagInput label="Adjectives (max 6)" tags={brandVoiceAdjectives} onChange={(tags) => setBrandVoiceAdjectives(tags.slice(0, 6))} placeholder="e.g. bold, warm, direct…" />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Forbidden Words" subtitle="Claude will never use these words.">
              <TagInput label="Never say" tags={forbiddenWords} onChange={setForbiddenWords} placeholder="e.g. cheap, diet, anti-aging…" />
            </Section>

            <Section title="Mandatory Mentions" subtitle="Must always be included (legal, core promise).">
              <TagInput label="Always include" tags={mandatoryMentions} onChange={setMandatoryMentions} placeholder="e.g. dermatologist-tested…" />
            </Section>
          </div>

          <Section title="Required Wording" subtitle="Exact phrases required by brand or legal guidelines.">
            <TagInput label="Required phrases" tags={requiredWording} onChange={setRequiredWording} placeholder="e.g. 100% natural ingredients…" />
          </Section>

          <Section title="Messaging Hierarchy" subtitle="Ordered from most to least important — Claude follows this priority.">
            <TagInput label="Messages (ordered)" tags={messagingHierarchy} onChange={setMessagingHierarchy} placeholder="e.g. Primary: transform your routine…" />
          </Section>

          <Section title="Call-to-Action Examples" subtitle="CTAs that fit this brand's tone.">
            <TagInput label="CTA examples" tags={callToActionExamples} onChange={setCallToActionExamples} placeholder="e.g. Shop the collection, Discover now…" />
          </Section>
        </div>

        {/* ══ GROUP 4: Creative Direction ═════════════════════════════════ */}
        <div className="space-y-6">
          <GroupHeader label="Creative Direction" />

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
            <PillSelect
              label="Preferred hooks"
              options={HOOK_OPTIONS}
              selected={preferredHooks}
              onChange={setPreferredHooks}
            />
            <TagInput label="Hooks to avoid" tags={avoidedHooks} onChange={setAvoidedHooks} placeholder="e.g. fomo, urgence…" />
          </Section>

          <Section title="Moodboard URLs" subtitle="Reference images for visual direction.">
            <ImageGallery label="Moodboard image URLs" urls={moodboardUrls} onChange={setMoodboardUrls} />
          </Section>

          <Section title="Reference Ad URLs" subtitle="Example ads that match the desired creative direction.">
            <TagInput label="Ad URLs" tags={referenceAdUrls} onChange={setReferenceAdUrls} placeholder="https://..." />
          </Section>
        </div>

        {/* ══ GROUP 5: Customer Intelligence ══════════════════════════════ */}
        <div className="space-y-6">
          <GroupHeader label="Customer Intelligence" />

          <Section title="Customer Reviews Verbatim" subtitle="Real customer quotes — max 10. Used directly in ad copy.">
            <TagInput label="Verbatim quotes (max 10)" tags={customerReviewsVerbatim} onChange={(tags) => setCustomerReviewsVerbatim(tags.slice(0, 10))} placeholder="Exact customer quote…" />
          </Section>

          <Section title="Customer Pain Points" subtitle="Problems customers had before finding this brand.">
            <TagInput label="Pain points" tags={customerPainPoints} onChange={setCustomerPainPoints} placeholder="e.g. struggled to find ethical alternatives…" />
          </Section>

          <Section title="Customer Desired Outcome" subtitle="The single most important outcome customers want.">
            <input
              type="text"
              value={customerDesiredOutcome}
              onChange={(e) => setCustomerDesiredOutcome(e.target.value)}
              placeholder="e.g. feel confident and put-together without effort…"
              className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
            />
          </Section>

          <Section title="Customer Objections" subtitle="Reasons someone might hesitate to buy.">
            <TagInput label="Objections" tags={customerObjections} onChange={setCustomerObjections} placeholder="e.g. too expensive, not sure if it works…" />
          </Section>

          {/* Customer Reviews extraction (Phase 2 legacy) */}
          <Section
            title="Extract from Reviews Page"
            subtitle="Paste a Trustpilot or reviews page URL — Claude extracts the real vocabulary your customers use."
          >
            <div className="flex gap-2">
              <input
                type="url"
                value={reviewsUrl}
                onChange={(e) => setReviewsUrl(e.target.value)}
                placeholder="https://www.trustpilot.com/review/yourbrand.com"
                className="flex-1 px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
              />
              <button
                type="button"
                onClick={extractReviews}
                disabled={extractingReviews || !reviewsUrl.trim()}
                className="px-4 py-2 text-sm font-semibold text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                style={{ background: 'var(--sf-accent)' }}
              >
                {extractingReviews ? "Extracting…" : "Extract with Claude"}
              </button>
            </div>
            {reviewsError && <p className="text-sm text-red-500">{reviewsError}</p>}
            {dna.customerVocabulary && (
              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-[var(--sf-text-primary)]">Extracted vocabulary</p>
                <ul className="space-y-1">
                  {dna.customerVocabulary.verbatims.slice(0, 5).map((v, i) => (
                    <li key={i} className="text-sm text-[var(--sf-text-primary)] italic border-l-2 pl-3" style={{ borderColor: 'var(--sf-accent-muted)' }}>
                      &ldquo;{v}&rdquo;
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {dna.customerVocabulary.emotionalWords.map((w, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs rounded-full" style={{ background: 'var(--sf-accent-muted)', color: 'var(--sf-accent)' }}>{w}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* ══ GROUP 6: Campaign Context (collapsible) ══════════════════════ */}
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setCampaignOpen((v) => !v)}
            className="flex items-center gap-3 w-full text-left"
          >
            <h2 className="text-lg font-bold text-[var(--sf-text-primary)]">Campaign Context</h2>
            <span className="text-xs px-2 py-0.5 bg-[var(--sf-bg-elevated)] text-[var(--sf-text-secondary)] rounded-full font-medium">Advanced</span>
            <span className="ml-auto text-[var(--sf-text-muted)] text-sm">{campaignOpen ? "▲ Collapse" : "▼ Expand"}</span>
          </button>

          {campaignOpen && (
            <>
              <Section title="Campaign Objective" subtitle="Current marketing objective for creative generation.">
                <div className="flex flex-wrap gap-2">
                  {CAMPAIGN_OBJECTIVES.map((obj) => (
                    <button
                      key={obj}
                      type="button"
                      onClick={() => setCurrentCampaignObjective(currentCampaignObjective === obj ? "" : obj)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors capitalize ${
                        currentCampaignObjective === obj
                          ? "bg-black text-white border-black"
                          : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)] hover:border-[var(--sf-border)]"
                      }`}
                    >
                      {obj}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Current Promotion" subtitle="Active promotion to highlight (optional).">
                <input
                  type="text"
                  value={currentPromotion}
                  onChange={(e) => setCurrentPromotion(e.target.value)}
                  placeholder="e.g. Summer Sale — 20% off all skincare…"
                  className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]"
                />
              </Section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Section title="Seasonal Constraints" subtitle="Dates, seasons, or events limiting creative choices.">
                  <TagInput label="Constraints" tags={seasonalConstraints} onChange={setSeasonalConstraints} placeholder="e.g. no summer imagery in Dec…" />
                </Section>

                <Section title="Legal Constraints" subtitle="Legal or compliance requirements for this campaign.">
                  <TagInput label="Constraints" tags={legalConstraints} onChange={setLegalConstraints} placeholder="e.g. must include disclaimer…" />
                </Section>
              </div>
            </>
          )}
        </div>

        {/* ══ GROUP 7: Brand Charter (deep enrichment) ════════════════════ */}
        <div className="space-y-6">
          <GroupHeader label="Brand Charter" badge="Manual enrichment" />

          <Section
            title="Brand Brief"
            subtitle="Free text: who you are, who you're not, your obsession."
          >
            <textarea
              value={brandBrief}
              onChange={(e) => setBrandBrief(e.target.value)}
              rows={4}
              placeholder="We want to be perceived as X. Our brand is never Y. Our obsession is Z…"
              className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none"
            />
          </Section>

          <Section
            title="Buyer Personas (Structured)"
            subtitle="Detailed personas with pain points and aspirations."
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--sf-text-primary)]">Personas</label>
                <button
                  type="button"
                  onClick={addPersona}
                  className="text-xs px-3 py-1.5 bg-[var(--sf-bg-elevated)] hover:bg-[var(--sf-bg-elevated)] rounded-lg font-medium transition-colors"
                >
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
                      <input type="text" value={p.name} onChange={(e) => updatePersona(i, { name: e.target.value })} placeholder="e.g. Sarah" className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--sf-text-secondary)] mb-1">Age range</label>
                      <input type="text" value={p.ageRange} onChange={(e) => updatePersona(i, { ageRange: e.target.value })} placeholder="e.g. 28-40" className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--sf-text-secondary)] mb-1">Description</label>
                    <textarea value={p.description} onChange={(e) => updatePersona(i, { description: e.target.value })} rows={2} placeholder="Who is this person? Lifestyle, habits, values…" className="w-full px-3 py-2 text-sm border border-[var(--sf-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--sf-accent)] resize-none" />
                  </div>
                  <TagInput label="Pain points" tags={p.painPoints} onChange={(tags) => updatePersona(i, { painPoints: tags })} placeholder="e.g. feels invisible, dry skin…" />
                  <TagInput label="Aspirations" tags={p.aspirations} onChange={(tags) => updatePersona(i, { aspirations: tags })} placeholder="e.g. feel confident, look effortless…" />
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Communication Angles"
            subtitle="Preferred and forbidden communication approaches."
          >
            <TagInput label="Preferred angles" tags={preferredAngles} onChange={setPreferredAngles} placeholder="e.g. transformation, authenticity, expertise…" />
            <TagInput label="Forbidden angles" tags={forbiddenAngles} onChange={setForbiddenAngles} placeholder="e.g. fear-based, aggressive discounts…" />
          </Section>
        </div>

        {/* ══ GROUP 8: Custom Assets ══════════════════════════════════════ */}
        <div className="space-y-6">
          <GroupHeader label="Custom Brand Assets" badge="Manual enrichment" />

          <Section
            title="Upload Assets"
            subtitle="Upload packshots, studio photos, or UGC. Passed to Gemini as reference images."
          >
            <div className="flex gap-2">
              {(["packshot", "studio", "ugc", "other"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAssetType(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    assetType === t
                      ? "bg-black text-white border-black"
                      : "bg-[var(--sf-bg-secondary)] text-[var(--sf-text-secondary)] border-[var(--sf-border)] hover:border-[var(--sf-border)]"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--sf-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--sf-border)] transition-colors"
            >
              {uploadingAsset ? (
                <p className="text-sm text-[var(--sf-text-secondary)]">Uploading…</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--sf-text-secondary)]">Drag & drop or <span className="underline font-medium">click to upload</span></p>
                  <p className="text-xs text-[var(--sf-text-muted)] mt-1">PNG, JPEG, WebP — max 10 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
            />
            {assetError && <p className="text-sm text-red-500">{assetError}</p>}
            {assets.length > 0 && (
              <div className="grid grid-cols-4 gap-3 pt-2">
                {assets.map((a) => (
                  <div key={a.id} className="relative group rounded-xl overflow-hidden border border-[var(--sf-border)] aspect-square bg-[var(--sf-bg-primary)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.fileName} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center truncate">{a.type}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

      </div>

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
