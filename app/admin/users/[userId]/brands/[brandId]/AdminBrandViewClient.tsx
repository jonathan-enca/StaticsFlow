"use client";

// Admin Brand View — full access to a user's brand DNA and creatives.
// Allows support admins to inspect and correct Brand DNA to help users
// improve the quality of their generated images.
//
// Sections:
//   1. Brand DNA overview (colors, tone, key benefits, forbidden words, etc.)
//   2. Inline editing for any Brand DNA field
//   3. Products list (read-only, links to user's product pages)
//   4. Creatives gallery with status badges + score

import { useState, useCallback } from "react";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  extractionStatus: string;
  createdAt: string;
  _count: { creatives: number };
}

interface Creative {
  id: string;
  imageUrl: string | null;
  status: string;
  score: number | null;
  format: string;
  angle: string;
  createdAt: string;
  product: { name: string } | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface Props {
  userId: string;
  brandId: string;
  brandName: string;
  brandUrl: string;
  dna: ExtractedBrandDNA;
  products: Product[];
  creatives: Creative[];
  creativePagination: Pagination;
}

// ──────────────────────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  QA_REVIEW: "bg-yellow-100 text-yellow-700",
  GENERATING: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
};

// ──────────────────────────────────────────────────────────────
// TagEditor — inline editable tag list
// ──────────────────────────────────────────────────────────────

function TagEditor({
  label,
  tags,
  onChange,
}: {
  label: string;
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
        {label}
      </label>
      <div
        className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-lg"
        style={{ background: "var(--sf-bg-elevated)", border: "1px solid var(--sf-border)" }}
      >
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{
              background: "var(--sf-bg-secondary)",
              color: "var(--sf-text-secondary)",
              border: "1px solid var(--sf-border)",
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((_, idx) => idx !== i))}
              className="leading-none hover:opacity-60"
              style={{ color: "var(--sf-text-muted)" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add tag…"
          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg outline-none"
          style={{
            background: "var(--sf-bg-elevated)",
            border: "1px solid var(--sf-border)",
            color: "var(--sf-text-primary)",
          }}
        />
        <button
          type="button"
          onClick={add}
          className="px-2.5 py-1.5 text-xs rounded-lg transition-opacity hover:opacity-80"
          style={{
            background: "var(--sf-bg-elevated)",
            border: "1px solid var(--sf-border)",
            color: "var(--sf-text-secondary)",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ColorSwatch
// ──────────────────────────────────────────────────────────────

function ColorSwatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-md flex-shrink-0 border"
        style={{ background: hex, borderColor: "var(--sf-border)" }}
      />
      <span className="text-xs" style={{ color: "var(--sf-text-secondary)" }}>
        {label}: <span className="font-mono">{hex}</span>
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section wrapper
// ──────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--sf-bg-secondary)",
        border: "1px solid var(--sf-border)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ color: "var(--sf-text-primary)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export default function AdminBrandViewClient({
  userId,
  brandId,
  brandName,
  brandUrl,
  dna: initialDna,
  products,
  creatives: initialCreatives,
  creativePagination: initialPagination,
}: Props) {
  const [dna, setDna] = useState<ExtractedBrandDNA>(initialDna);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"dna" | "creatives">("dna");
  const [creatives, setCreatives] = useState(initialCreatives);
  const [pagination, setPagination] = useState(initialPagination);
  const [loadingCreatives, setLoadingCreatives] = useState(false);

  // ── DNA field helpers ──

  const setField = useCallback(
    <K extends keyof ExtractedBrandDNA>(key: K, value: ExtractedBrandDNA[K]) => {
      setDna((prev) => ({ ...prev, [key]: value }));
      setSaveStatus("idle");
    },
    []
  );

  // ── Save DNA ──

  async function saveDna() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/admin/users/${userId}/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dna),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  // ── Load more creatives ──

  async function loadCreativesPage(page: number) {
    setLoadingCreatives(true);
    try {
      const res = await fetch(
        `/api/admin/users/${userId}/brands/${brandId}?page=${page}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCreatives(data.creatives);
      setPagination(data.creativePagination);
    } catch {
      // keep existing
    } finally {
      setLoadingCreatives(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--sf-text-primary)" }}>
            {brandName}
          </h1>
          <a
            href={brandUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:opacity-80"
            style={{ color: "var(--sf-text-muted)" }}
          >
            {brandUrl} ↗
          </a>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 rounded-lg p-1"
          style={{ background: "var(--sf-bg-elevated)", border: "1px solid var(--sf-border)" }}
        >
          {(["dna", "creatives"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 text-sm rounded-md transition-colors"
              style={
                activeTab === tab
                  ? { background: "var(--sf-accent)", color: "#fff" }
                  : { color: "var(--sf-text-secondary)" }
              }
            >
              {tab === "dna" ? "Brand DNA" : `Creatives (${pagination.total})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Brand DNA Tab ── */}
      {activeTab === "dna" && (
        <div className="space-y-4">
          {/* Save bar */}
          <div
            className="flex items-center justify-between rounded-xl px-5 py-3"
            style={{ background: "var(--sf-bg-secondary)", border: "1px solid var(--sf-border)" }}
          >
            <span className="text-sm" style={{ color: "var(--sf-text-secondary)" }}>
              {saveStatus === "saved" && "✓ Saved"}
              {saveStatus === "error" && "⚠ Save failed"}
              {saveStatus === "idle" && "Edit Brand DNA below, then save."}
            </span>
            <button
              onClick={saveDna}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--sf-accent)", color: "#fff" }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>

          {/* Visuals */}
          <Section title="Visuals & Colors">
            <div className="space-y-3">
              {dna.colors && (
                <div className="flex flex-wrap gap-3">
                  <ColorSwatch hex={dna.colors.primary} label="Primary" />
                  <ColorSwatch hex={dna.colors.secondary} label="Secondary" />
                  <ColorSwatch hex={dna.colors.accent} label="Accent" />
                </div>
              )}
              {dna.fonts && dna.fonts.length > 0 && (
                <div className="text-xs" style={{ color: "var(--sf-text-secondary)" }}>
                  <span style={{ color: "var(--sf-text-muted)" }}>Fonts: </span>
                  {dna.fonts.join(", ")}
                </div>
              )}
            </div>
          </Section>

          {/* Identity */}
          <Section title="Identity & Positioning">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                  Tone of voice
                </label>
                <textarea
                  value={dna.toneOfVoice ?? ""}
                  onChange={(e) => setField("toneOfVoice", e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                  style={{
                    background: "var(--sf-bg-elevated)",
                    border: "1px solid var(--sf-border)",
                    color: "var(--sf-text-primary)",
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                  Brand voice
                </label>
                <textarea
                  value={dna.brandVoice ?? ""}
                  onChange={(e) => setField("brandVoice", e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                  style={{
                    background: "var(--sf-bg-elevated)",
                    border: "1px solid var(--sf-border)",
                    color: "var(--sf-text-primary)",
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                  Brand archetype
                </label>
                <input
                  type="text"
                  value={dna.brandArchetype ?? ""}
                  onChange={(e) => setField("brandArchetype", e.target.value as ExtractedBrandDNA["brandArchetype"])}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                  style={{
                    background: "var(--sf-bg-elevated)",
                    border: "1px solid var(--sf-border)",
                    color: "var(--sf-text-primary)",
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                  Price positioning
                </label>
                <select
                  value={dna.pricePositioning ?? ""}
                  onChange={(e) => setField("pricePositioning", e.target.value as ExtractedBrandDNA["pricePositioning"])}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                  style={{
                    background: "var(--sf-bg-elevated)",
                    border: "1px solid var(--sf-border)",
                    color: "var(--sf-text-primary)",
                  }}
                >
                  <option value="">—</option>
                  {["budget", "mid-range", "premium", "ultra-premium"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          {/* Messaging */}
          <Section title="Messaging & Copy">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TagEditor
                label="Key benefits"
                tags={dna.keyBenefits ?? []}
                onChange={(v) => setField("keyBenefits", v)}
              />
              <TagEditor
                label="Brand voice adjectives"
                tags={dna.brandVoiceAdjectives ?? []}
                onChange={(v) => setField("brandVoiceAdjectives", v)}
              />
              <TagEditor
                label="Forbidden words"
                tags={dna.forbiddenWords ?? []}
                onChange={(v) => setField("forbiddenWords", v)}
              />
              <TagEditor
                label="Required wording"
                tags={dna.requiredWording ?? []}
                onChange={(v) => setField("requiredWording", v)}
              />
              <TagEditor
                label="Mandatory mentions"
                tags={dna.mandatoryMentions ?? []}
                onChange={(v) => setField("mandatoryMentions", v)}
              />
              <TagEditor
                label="Call-to-action examples"
                tags={dna.callToActionExamples ?? []}
                onChange={(v) => setField("callToActionExamples", v)}
              />
              <TagEditor
                label="Messaging hierarchy"
                tags={dna.messagingHierarchy ?? []}
                onChange={(v) => setField("messagingHierarchy", v)}
              />
              <TagEditor
                label="Differentiators"
                tags={dna.differentiators ?? []}
                onChange={(v) => setField("differentiators", v)}
              />
            </div>
          </Section>

          {/* Creative direction */}
          <Section title="Creative Direction">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TagEditor
                label="Visual style keywords"
                tags={dna.visualStyleKeywords ?? []}
                onChange={(v) => setField("visualStyleKeywords", v)}
              />
              <TagEditor
                label="Creative do-list"
                tags={dna.creativeDoList ?? []}
                onChange={(v) => setField("creativeDoList", v)}
              />
              <TagEditor
                label="Creative don't-list"
                tags={dna.creativeDontList ?? []}
                onChange={(v) => setField("creativeDontList", v)}
              />
            </div>
            <div className="mt-4 space-y-1.5">
              <label className="block text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                Brand brief (admin notes)
              </label>
              <textarea
                value={dna.brandBrief ?? ""}
                onChange={(e) => setField("brandBrief", e.target.value)}
                rows={4}
                placeholder="Write a free-form brand brief visible to Claude during creative generation…"
                className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-y"
                style={{
                  background: "var(--sf-bg-elevated)",
                  border: "1px solid var(--sf-border)",
                  color: "var(--sf-text-primary)",
                }}
              />
            </div>
          </Section>

          {/* Products list */}
          <Section title={`Products (${products.length})`}>
            {products.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>No products yet.</p>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: "var(--sf-bg-elevated)", border: "1px solid var(--sf-border)" }}
                  >
                    <div>
                      <span className="text-sm font-medium" style={{ color: "var(--sf-text-primary)" }}>
                        {p.name}
                      </span>
                      {p.isDefault && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          default
                        </span>
                      )}
                      {!p.isActive && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                      <span>{p._count.creatives} creatives</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full ${
                          p.extractionStatus === "done"
                            ? "bg-green-100 text-green-700"
                            : p.extractionStatus === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {p.extractionStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── Creatives Tab ── */}
      {activeTab === "creatives" && (
        <div>
          {creatives.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center"
              style={{
                background: "var(--sf-bg-secondary)",
                border: "1px solid var(--sf-border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                No creatives generated yet.
              </p>
            </div>
          ) : (
            <>
              <div
                className={`grid gap-3 ${loadingCreatives ? "opacity-50 pointer-events-none" : ""}`}
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
              >
                {creatives.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "var(--sf-bg-secondary)",
                      border: "1px solid var(--sf-border)",
                    }}
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div
                        className="w-full aspect-square flex items-center justify-center text-xs"
                        style={{
                          background: "var(--sf-bg-elevated)",
                          color: "var(--sf-text-muted)",
                        }}
                      >
                        {c.status === "GENERATING" ? "Generating…" : "No image"}
                      </div>
                    )}
                    <div className="p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {c.status}
                        </span>
                        {c.score != null && (
                          <span className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                            {Math.round(c.score * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                        {c.format} · {c.angle}
                      </div>
                      {c.product && (
                        <div className="text-xs truncate" style={{ color: "var(--sf-text-muted)" }}>
                          {c.product.name}
                        </div>
                      )}
                      <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                        {fmtDate(c.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <span className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                    {pagination.total} creatives — page {pagination.page} / {pagination.pages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={pagination.page <= 1 || loadingCreatives}
                      onClick={() => loadCreativesPage(pagination.page - 1)}
                      className="px-3 py-1 rounded-lg text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{
                        background: "var(--sf-bg-secondary)",
                        border: "1px solid var(--sf-border)",
                        color: "var(--sf-text-primary)",
                      }}
                    >
                      ← Prev
                    </button>
                    <button
                      disabled={pagination.page >= pagination.pages || loadingCreatives}
                      onClick={() => loadCreativesPage(pagination.page + 1)}
                      className="px-3 py-1 rounded-lg text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{
                        background: "var(--sf-bg-secondary)",
                        border: "1px solid var(--sf-border)",
                        color: "var(--sf-text-primary)",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
