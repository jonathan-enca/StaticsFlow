"use client";

// API key manager for the settings page.
// Saves keys to the user's server-side profile via PATCH /api/user/api-keys.
// Also syncs from localStorage (set during onboarding) so logged-in users
// can persist their keys with one click.

import { useState, useEffect } from "react";
import { Key, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  initialAnthropicPreview: string | null;
  initialGeminiPreview: string | null;
}

export default function ApiKeysClient({ initialAnthropicPreview, initialGeminiPreview }: Props) {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [anthropicPreview, setAnthropicPreview] = useState(initialAnthropicPreview);
  const [geminiPreview, setGeminiPreview] = useState(initialGeminiPreview);

  // Pre-fill from localStorage (set during onboarding) if not yet saved to DB
  useEffect(() => {
    if (!initialAnthropicPreview) {
      const stored = localStorage.getItem("sf_anthropic_key");
      if (stored) setAnthropicKey(stored);
    }
    if (!initialGeminiPreview) {
      const stored = localStorage.getItem("sf_gemini_key");
      if (stored) setGeminiKey(stored);
    }
  }, [initialAnthropicPreview, initialGeminiPreview]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const body: Record<string, string> = {};
    if (anthropicKey.trim()) body.anthropicApiKey = anthropicKey.trim();
    if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim();

    const res = await fetch("/api/user/api-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save keys");
      return;
    }

    // Update previews + clear inputs
    if (anthropicKey.trim()) {
      setAnthropicPreview(`${anthropicKey.trim().slice(0, 10)}…`);
      localStorage.setItem("sf_anthropic_key", anthropicKey.trim());
    }
    if (geminiKey.trim()) {
      setGeminiPreview(`${geminiKey.trim().slice(0, 8)}…`);
      localStorage.setItem("sf_gemini_key", geminiKey.trim());
    }

    setAnthropicKey("");
    setGeminiKey("");
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  async function removeKey(key: "anthropic" | "gemini") {
    const body =
      key === "anthropic" ? { anthropicApiKey: "" } : { geminiApiKey: "" };

    const res = await fetch("/api/user/api-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      if (key === "anthropic") {
        setAnthropicPreview(null);
        localStorage.removeItem("sf_anthropic_key");
      } else {
        setGeminiPreview(null);
        localStorage.removeItem("sf_gemini_key");
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">API Keys (BYOK)</h2>
      </div>

      <p className="text-sm text-gray-500">
        StaticsFlow uses your own API keys to generate creatives. Keys are stored encrypted and never logged.
        Once saved here, you&apos;ll never need to enter them again.
      </p>

      {/* Saved key status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Claude (Anthropic)</p>
            {anthropicPreview ? (
              <p className="text-xs text-gray-500 font-mono mt-0.5">{anthropicPreview}</p>
            ) : (
              <p className="text-xs text-amber-600 mt-0.5">Not saved</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {anthropicPreview ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <button
                  type="button"
                  onClick={() => removeKey("anthropic")}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </>
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Gemini (Google)</p>
            {geminiPreview ? (
              <p className="text-xs text-gray-500 font-mono mt-0.5">{geminiPreview}</p>
            ) : (
              <p className="text-xs text-amber-600 mt-0.5">Not saved</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {geminiPreview ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <button
                  type="button"
                  onClick={() => removeKey("gemini")}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </>
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
          </div>
        </div>
      </div>

      {/* Update form */}
      <form onSubmit={save} className="space-y-4 pt-2">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-600">
              {anthropicPreview ? "Update Claude API Key" : "Claude API Key"}
            </label>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-orange-500 hover:opacity-80"
            >
              Get key →
            </a>
          </div>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder={anthropicPreview ? "Enter new key to replace…" : "sk-ant-…"}
            autoComplete="off"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black font-mono bg-gray-50"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-600">
              {geminiPreview ? "Update Gemini API Key" : "Gemini API Key"}
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-orange-500 hover:opacity-80"
            >
              Get key →
            </a>
          </div>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder={geminiPreview ? "Enter new key to replace…" : "AIza…"}
            autoComplete="off"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black font-mono bg-gray-50"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {saved && (
          <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Keys saved — you&apos;re all set.
          </p>
        )}

        <button
          type="submit"
          disabled={saving || (!anthropicKey.trim() && !geminiKey.trim())}
          className="w-full py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save API Keys"}
        </button>
      </form>
    </div>
  );
}
