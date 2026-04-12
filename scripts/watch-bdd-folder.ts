/**
 * watch-bdd-folder.ts
 *
 * Watches a local folder for new ad creative images and uploads them to the
 * BDD Manager API. Two modes:
 *
 *   --once   Process all images in the folder then exit (initial 4,000 import)
 *   default  Watch for new files added to the folder (ongoing ingestion)
 *
 * Usage:
 *   npx tsx scripts/watch-bdd-folder.ts --folder /path/to/creatives --api-url http://localhost:3000
 *   npx tsx scripts/watch-bdd-folder.ts --folder /path/to/creatives --once
 *
 * Auth:
 *   Set ADMIN_SESSION_TOKEN env var, or pass --token <value>.
 *   The token is the NextAuth session token from your browser cookies
 *   (cookie name: authjs.session-token).
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import chokidar from "chokidar";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const SIDECAR_FILENAME = ".bdd-processed.json";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// ─────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    folder: { type: "string" },
    "api-url": { type: "string", default: "http://localhost:3000" },
    token: { type: "string" },
    once: { type: "boolean", default: false },
  },
  strict: true,
});

const folderArg = values["folder"];
const apiUrl = (values["api-url"] as string).replace(/\/$/, "");
const token = values["token"] ?? process.env.ADMIN_SESSION_TOKEN;
const onceMode = Boolean(values["once"]);

if (!folderArg) {
  console.error("Error: --folder <path> is required");
  process.exit(1);
}

if (!token) {
  console.error(
    "Error: provide --token <session-token> or set ADMIN_SESSION_TOKEN.\n" +
      "Get the token from your browser: DevTools → Application → Cookies → authjs.session-token"
  );
  process.exit(1);
}

const folder = path.resolve(folderArg);

if (!fs.existsSync(folder)) {
  console.error(`Error: folder not found: ${folder}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Sidecar (tracks already-processed files)
// ─────────────────────────────────────────────────────────────

const sidecarPath = path.join(folder, SIDECAR_FILENAME);

function loadProcessed(): Set<string> {
  try {
    const raw = fs.readFileSync(sidecarPath, "utf8");
    const data = JSON.parse(raw);
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

function saveProcessed(processed: Set<string>): void {
  fs.writeFileSync(sidecarPath, JSON.stringify(Array.from(processed), null, 2));
}

// ─────────────────────────────────────────────────────────────
// Upload a single file
// ─────────────────────────────────────────────────────────────

async function uploadFile(
  filePath: string,
  processed: Set<string>
): Promise<void> {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();

  if (!IMAGE_EXTENSIONS.has(ext)) return;

  if (processed.has(filePath)) {
    console.log(`  [skip]     ${filename}`);
    return;
  }

  console.log(`  [upload]   ${filename}`);

  try {
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer], { type: MIME[ext] ?? "image/jpeg" });

    const formData = new FormData();
    formData.append("files", blob, filename);

    const res = await fetch(`${apiUrl}/api/admin/bdd/upload`, {
      method: "POST",
      headers: {
        // NextAuth v5 cookie name (non-secure dev: authjs.session-token)
        Cookie: `authjs.session-token=${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    if (res.ok && (data.success ?? 0) > 0) {
      processed.add(filePath);
      saveProcessed(processed);
      console.log(`  [done]     ${filename}`);
    } else {
      const err = data.errors?.[0]?.error ?? data.error ?? "Upload failed";
      console.error(`  [error]    ${filename}: ${err}`);
    }
  } catch (err) {
    console.error(`  [error]    ${filename}: ${String(err)}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const processed = loadProcessed();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  BDD Folder Importer");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Folder  : ${folder}`);
  console.log(`  API     : ${apiUrl}`);
  console.log(`  Mode    : ${onceMode ? "one-shot (--once)" : "watch"}`);
  console.log(`  Skipping: ${processed.size} already-processed file(s)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (onceMode) {
    // ── One-shot: process all existing images then exit ──────────
    const allFiles = fs
      .readdirSync(folder)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map((f) => path.join(folder, f));

    const remaining = allFiles.filter((f) => !processed.has(f));
    console.log(
      `Found ${allFiles.length} image(s) — ${remaining.length} to upload, ${allFiles.length - remaining.length} already done.\n`
    );

    let count = 0;
    for (const filePath of allFiles) {
      await uploadFile(filePath, processed);
      count++;
      if (count % 100 === 0) {
        console.log(
          `\n  ── Progress: ${count} / ${allFiles.length} (${Math.round((count / allFiles.length) * 100)}%) ──\n`
        );
      }
    }

    console.log(
      `\nDone! ${allFiles.length} file(s) processed (${processed.size} total in sidecar).`
    );
    process.exit(0);
  } else {
    // ── Watch mode: upload new files as they appear ──────────────
    console.log("Watching for new images… (Ctrl+C to stop)\n");

    const watcher = chokidar.watch(folder, {
      ignored: [
        /(^|[/\\])\../, // dotfiles (including .bdd-processed.json)
        /\.json$/,
      ],
      persistent: true,
      ignoreInitial: true, // don't fire for files already in folder on start
    });

    watcher.on("add", (filePath: string) => {
      uploadFile(filePath, processed).catch((err) =>
        console.error(`Unhandled error for ${filePath}:`, err)
      );
    });

    watcher.on("error", (err: unknown) => {
      console.error("Watcher error:", err);
    });

    // Keep process alive
    process.on("SIGINT", () => {
      console.log("\nStopping watcher.");
      watcher.close().then(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
