"use client";

// Lightbox modal for previewing generated creatives.
// Renders via React portal at document.body to avoid z-index / overflow issues.
// Dismiss: click backdrop, press Escape, or click the × button.

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface InspirationSource {
  type: "template" | "url" | "upload";
  imageUrl: string | null;
  label: string;
}

export interface CreativePreviewData {
  id: string;
  imageUrl: string | null;
  status: string;
  score: number | null;
  format: string;
  angle: string;
}

interface Props {
  creative: CreativePreviewData;
  inspirationSource?: InspirationSource;
  brandName: string;
  onClose: () => void;
}

export default function CreativePreviewModal({ creative, inspirationSource, brandName, onClose }: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const scoreDisplay = creative.score != null ? `${Math.round(creative.score * 100)}%` : null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Creative preview"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-150" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-10 bg-[var(--sf-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white text-sm leading-none"
        >
          ✕
        </button>

        {/* Main image area */}
        <div className="flex-1 overflow-auto p-4 bg-[var(--sf-bg-primary)] flex items-center justify-center min-h-32">
          {creative.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative.imageUrl}
              alt="Generated creative"
              className="w-full max-h-[60vh] object-contain rounded-xl"
            />
          ) : (
            <p className="py-16 text-sm text-[var(--sf-text-muted)]">Image not available</p>
          )}
        </div>

        {/* Info bar */}
        <div className="px-5 py-3 border-t border-[var(--sf-border)] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="capitalize font-semibold text-[var(--sf-text-primary)]">{creative.angle}</span>
            <span className="text-[var(--sf-text-muted)]">·</span>
            <span className="text-[var(--sf-text-secondary)]">{creative.format}</span>
            {scoreDisplay && (
              <>
                <span className="text-[var(--sf-text-muted)]">·</span>
                <span className="text-[var(--sf-text-secondary)]">Score: {scoreDisplay}</span>
              </>
            )}
            <span className="text-[var(--sf-text-muted)]">·</span>
            <span className={
              creative.status === "APPROVED" ? "text-green-600 font-medium"
              : creative.status === "REJECTED" ? "text-red-600 font-medium"
              : creative.status === "QA_REVIEW" ? "text-amber-600 font-medium"
              : "text-[var(--sf-text-secondary)]"
            }>
              {creative.status === "QA_REVIEW" ? "Needs review" : creative.status}
            </span>
          </div>

          {creative.imageUrl && (
            <a
              href={creative.imageUrl}
              download={`${brandName}_${creative.angle}_${creative.format}.png`}
              className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-black/80 transition-colors flex-shrink-0 flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          )}
        </div>

        {/* Inspiration source — only shown when an image URL is available */}
        {inspirationSource?.imageUrl && (
          <div className="px-5 py-4 border-t border-[var(--sf-border)] flex items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--sf-text-muted)] flex-shrink-0">
              Inspired by
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={inspirationSource.imageUrl}
              alt="Inspiration"
              className="w-16 h-16 rounded-lg object-cover border border-[var(--sf-border)] flex-shrink-0"
            />
            <span className="text-sm text-[var(--sf-text-secondary)]">{inspirationSource.label}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
