"use client";

// Brand DNA Enrichment UI — auto-extracted + manual enrichment
// Layout: two-column desktop (auto-extracted | manual enrichment)
// C3/C4/M5: auto-extracted section editable, color pickers, tag lists, galleries

import { useState, useRef } from "react";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { Persona, CommunicationAngles, CustomAsset } from "@/types/index";

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
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border border-gray-200 rounded-lg bg-white">
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-sm"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-gray-400 hover:text-gray-600 leading-none"
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
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
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
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-gray-100 border border-gray-200">
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
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="button" onClick={addUrl} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">
          Add
        </button>
      </div>
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

  // ── Auto-extracted fields (editable) ───────────────────────────────────────
  const [colors, setColors] = useState(dna.colors);
  const [fonts, setFonts] = useState<string[]>(dna.fonts ?? []);
  const [logoUrl, setLogoUrl] = useState(dna.logoUrl ?? "");
  const [toneOfVoice, setToneOfVoice] = useState(dna.toneOfVoice ?? "");
  const [brandVoice, setBrandVoice] = useState(dna.brandVoice ?? "");
  const [keyBenefits, setKeyBenefits] = useState<string[]>(dna.keyBenefits ?? []);
  const [personas, setPersonas] = useState<string[]>(dna.personas ?? []);
  const [productImages, setProductImages] = useState<string[]>(dna.productImages ?? []);
  const [lifestyleImages, setLifestyleImages] = useState<string[]>(dna.lifestyleImages ?? []);

  // ── Manual enrichment fields ────────────────────────────────────────────────
  const [reviewsUrl, setReviewsUrl] = useState(dna.reviewsUrl ?? "");
  const [extractingReviews, setExtractingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [forbiddenWords, setForbiddenWords] = useState<string[]>(dna.forbiddenWords ?? []);
  const [requiredWording, setRequiredWording] = useState<string[]>(dna.requiredWording ?? []);
  const [assets, setAssets] = useState<CustomAsset[]>(dna.customAssets ?? []);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<"packshot" | "studio" | "ugc" | "other">("packshot");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brandBrief, setBrandBrief] = useState(dna.brandBrief ?? "");
  const [structuredPersonas, setStructuredPersonas] = useState<Persona[]>(
    dna.structuredPersonas ?? []
  );
  const [preferredAngles, setPreferredAngles] = useState<string[]>(
    dna.communicationAngles?.preferred ?? []
  );
  const [forbiddenAngles, setForbiddenAngles] = useState<string[]>(
    dna.communicationAngles?.forbidden ?? []
  );

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
          // Auto-extracted overrides
          colors,
          fonts,
          logoUrl: logoUrl || null,
          toneOfVoice,
          brandVoice,
          keyBenefits,
          personas,
          productImages,
          lifestyleImages,
          // Manual enrichment
          forbiddenWords,
          requiredWording,
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
          <p className="text-sm text-gray-500 mb-1">
            <a href="/dashboard" className="hover:underline">Dashboard</a> / Brand DNA
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{brandName}</h1>
        </div>
        <SaveButton />
      </div>

      {saveError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {saveError}
        </div>
      )}

      {/* Two-column layout: auto-extracted (left) | manual enrichment (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: Auto-Extracted Brand DNA ─────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-bold text-gray-900">Auto-Extracted</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sf-accent-muted)', color: 'var(--sf-accent)' }}>
              Editable
            </span>
          </div>

          {/* Colors */}
          <Section title="Brand Colors" subtitle="Edit directly — changes are applied to all future creatives.">
            <div className="space-y-3">
              {(["primary", "secondary", "accent"] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-24 text-sm font-medium text-gray-700 capitalize">{key}</label>
                  <div className="relative">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
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
                    className="w-28 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="#000000"
                    maxLength={7}
                  />
                  <div
                    className="flex-1 h-8 rounded-lg border border-gray-200"
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
                <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </Section>

          {/* Fonts */}
          <Section title="Fonts" subtitle="Brand typefaces. Used for guidance in Gemini prompts.">
            <TagInput label="Font names" tags={fonts} onChange={setFonts} placeholder="e.g. Inter, Playfair Display…" />
          </Section>

          {/* Tone of Voice */}
          <Section title="Tone of Voice" subtitle="How the brand communicates. Injected into every Claude brief.">
            <textarea
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              rows={3}
              placeholder="Casual and warm, uses tutoiement, emphasis on community and authenticity…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </Section>

          {/* Brand Voice */}
          <Section title="Brand Voice" subtitle="What makes this brand's communication unique.">
            <textarea
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              rows={3}
              placeholder="2-3 sentences describing what makes this brand's voice unique…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </Section>

          {/* Key Benefits */}
          <Section title="Key Benefits" subtitle="Core product benefits used in ad copy.">
            <TagInput label="Benefits" tags={keyBenefits} onChange={setKeyBenefits} placeholder="e.g. 100% natural, dermatologist-tested…" />
          </Section>

          {/* Personas */}
          <Section title="Target Personas" subtitle="Auto-extracted customer profiles.">
            <TagInput label="Personas" tags={personas} onChange={setPersonas} placeholder="e.g. Women 28-40, urban, health-conscious…" />
          </Section>

          {/* Product images */}
          <Section title="Product Images" subtitle="Packshots and product photos. Added as visual context.">
            <ImageGallery label="Product image URLs" urls={productImages} onChange={setProductImages} />
          </Section>

          {/* Lifestyle images */}
          <Section title="Lifestyle Images" subtitle="Editorial and lifestyle photos from the brand website.">
            <ImageGallery label="Lifestyle image URLs" urls={lifestyleImages} onChange={setLifestyleImages} />
          </Section>
        </div>

        {/* ── RIGHT: Manual Enrichment ────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-bold text-gray-900">Manual Enrichment</h2>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
              Add depth
            </span>
          </div>

          {/* Customer Reviews */}
          <Section
            title="Customer Reviews"
            subtitle="Paste a Trustpilot or reviews page URL — Claude extracts the real vocabulary your customers use."
          >
            <div className="flex gap-2">
              <input
                type="url"
                value={reviewsUrl}
                onChange={(e) => setReviewsUrl(e.target.value)}
                placeholder="https://www.trustpilot.com/review/yourbrand.com"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
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
                <p className="text-sm font-medium text-gray-700">Extracted vocabulary</p>
                <ul className="space-y-1">
                  {dna.customerVocabulary.verbatims.slice(0, 5).map((v, i) => (
                    <li key={i} className="text-sm text-gray-700 italic border-l-2 pl-3" style={{ borderColor: 'var(--sf-accent-muted)' }}>
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

          {/* Wording Rules */}
          <Section
            title="Wording Rules"
            subtitle="These are injected into every creative brief — Claude will never violate them."
          >
            <TagInput label="Forbidden words (never say)" tags={forbiddenWords} onChange={setForbiddenWords} placeholder="e.g. cheap, diet, anti-aging…" />
            <TagInput label="Required wording (always include)" tags={requiredWording} onChange={setRequiredWording} placeholder="e.g. dermatologist-tested, 100% natural…" />
          </Section>

          {/* Custom Assets */}
          <Section
            title="Custom Brand Assets"
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
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
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
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              {uploadingAsset ? (
                <p className="text-sm text-gray-500">Uploading…</p>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Drag & drop or <span className="underline font-medium">click to upload</span></p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPEG, WebP — max 10 MB</p>
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
                  <div key={a.id} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.fileName} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center truncate">{a.type}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Brand Charter */}
          <Section
            title="Brand Charter"
            subtitle="Define your brand's personality, target personas, and preferred communication angles."
          >
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Brand brief <span className="text-gray-400 font-normal">(free text)</span>
              </label>
              <textarea
                value={brandBrief}
                onChange={(e) => setBrandBrief(e.target.value)}
                rows={4}
                placeholder="We want to be perceived as X. Our brand is never Y. Our obsession is Z…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>

            {/* Structured personas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Buyer personas</label>
                <button
                  type="button"
                  onClick={addPersona}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  + Add persona
                </button>
              </div>
              {structuredPersonas.map((p, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Persona {i + 1}</p>
                    <button type="button" onClick={() => removePersona(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input type="text" value={p.name} onChange={(e) => updatePersona(i, { name: e.target.value })} placeholder="e.g. Sarah" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Age range</label>
                      <input type="text" value={p.ageRange} onChange={(e) => updatePersona(i, { ageRange: e.target.value })} placeholder="e.g. 28-40" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <textarea value={p.description} onChange={(e) => updatePersona(i, { description: e.target.value })} rows={2} placeholder="Who is this person? Lifestyle, habits, values…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                  </div>
                  <TagInput label="Pain points" tags={p.painPoints} onChange={(tags) => updatePersona(i, { painPoints: tags })} placeholder="e.g. feels invisible, dry skin…" />
                  <TagInput label="Aspirations" tags={p.aspirations} onChange={(tags) => updatePersona(i, { aspirations: tags })} placeholder="e.g. feel confident, look effortless…" />
                </div>
              ))}
            </div>

            <TagInput label="Preferred communication angles" tags={preferredAngles} onChange={setPreferredAngles} placeholder="e.g. transformation, authenticity, expertise…" />
            <TagInput label="Forbidden communication angles" tags={forbiddenAngles} onChange={setForbiddenAngles} placeholder="e.g. fear-based, aggressive discounts…" />
          </Section>
        </div>
      </div>

      {/* Bottom save bar */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          All changes are applied to future creatives for this brand.
        </p>
        <SaveButton />
      </div>
    </div>
  );
}
