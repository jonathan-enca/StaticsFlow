"use client";
// DeleteBrandButton — renders a "Delete brand" button with a confirmation dialog.
// Used in the dashboard brand cards. On confirm, calls DELETE /api/brands/[brandId]
// then redirects to /dashboard (router.refresh is not sufficient since the list is server-rendered).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface Props {
  brandId: string;
  brandName: string;
}

export default function DeleteBrandButton({ brandId, brandName }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete brand");
      }
      // Full refresh so the server-rendered list updates
      router.refresh();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-md hover:opacity-80 transition-opacity"
        style={{ color: "var(--sf-danger, #ff3b30)" }}
        title="Delete brand"
        aria-label="Delete brand"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Confirmation dialog overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="rounded-xl border p-6 max-w-sm w-full space-y-4 shadow-2xl"
            style={{
              background: "var(--sf-bg-secondary)",
              borderColor: "var(--sf-border)",
            }}
          >
            <div className="space-y-1">
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--sf-text-primary)" }}
              >
                Delete brand?
              </h2>
              <p className="text-sm" style={{ color: "var(--sf-text-secondary)" }}>
                <strong style={{ color: "var(--sf-text-primary)" }}>{brandName}</strong> and
                all its products, inspirations, and creatives will be permanently deleted.
                This action cannot be undone.
              </p>
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--sf-danger, #ff3b30)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-md hover:opacity-80 transition-opacity"
                style={{
                  background: "var(--sf-bg-elevated)",
                  color: "var(--sf-text-primary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: "var(--sf-danger, #ff3b30)" }}
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
