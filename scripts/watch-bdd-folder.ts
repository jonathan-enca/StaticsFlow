/**
 * watch-bdd-folder.ts
 *
 * Watches a local folder for new ad creative images and uploads them to the
 * BDD Manager API. Two modes:
 *
 *   --once        Process all images in the folder then exit (initial 4,000 import)
 *   --limit N     Stop after uploading N new files (pilot runs, token budgeting)
 *   default       Watch for new files added to the folder (ongoing ingestion)
 *
 * Usage:
 *   npx tsx scripts/watch-bdd-folder.ts --folder /path/to/creatives --api-url http://localhost:3000
 *   npx tsx scripts/watch-bdd-folder.ts --folder /path/to/creatives --once
 *   npx tsx scripts/watch-bdd-folder.ts --folder "/path/to/templates copie" --once --limit 100
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
    limit: { type: "string" }, // parsed as number below
  },
  strict: true,
});

const folderArg = values["folder"];
const apiUrl = (values["api-url"] as string).replace(/\/$/, "");
const token = values["token"] ?? process.env.ADMIN_SESSION_TOKEN;
const onceMode = Boolean(values["once"]);

const limitArg = values["limit"];
const uploadLimit: number | null = limitArg != null ? parseInt(limitArg, 10) : null;
if (uploadLimit !== null && (isNaN(uploadLimit) || uploadLimit < 1)) {
  console.error("Error: --limit must be a positive integer");
  process.exit(1);
}

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
  if (uploadLimit !== null) console.log(`  Limit   : ${uploadLimit} file(s)`);
  console.log(`  Skipping: ${processed.size} already-processed file(s)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (onceMode) {
    // ── One-shot: process all existing images then exit ──────────
    const allFiles = fs
      .readdirSync(folder)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map((f) => path.join(folder, f));

    const remaining = allFiles.filter((f) => !processed.has(f));
    const toUpload =
      uploadLimit !== null ? remaining.slice(0, uploadLimit) : remaining;
    console.log(
      `Found ${allFiles.length} image(s) — ${remaining.length} to upload` +
        (uploadLimit !== null ? ` (capped at ${uploadLimit} by --limit)` : "") +
        `, ${allFiles.length - remaining.length} already done.\n`
    );

    let uploaded = 0;
    for (const filePath of toUpload) {
      await uploadFile(filePath, processed);
      uploaded++;
      if (uploaded % 100 === 0) {
        console.log(
          `\n  ── Progress: ${uploaded} / ${toUpload.length} (${Math.round((uploaded / toUpload.length) * 100)}%) ──\n`
        );
      }
    }

    console.log(
      `\nDone! ${uploaded} file(s) uploaded this run (${processed.size} total in sidecar).`
    );
    if (uploadLimit !== null && remaining.length > uploadLimit) {
      console.log(
        `  ${remaining.length - uploadLimit} file(s) remain — re-run without changes to continue from file ${uploadLimit + 1}.`
      );
    }
    process.exit(0);
  } else {
    // ── Watch mode: upload new files as they appear ──────────────
    console.log(
      `Watching for new images…${uploadLimit !== null ? ` (stops after ${uploadLimit} upload(s))` : ""} (Ctrl+C to stop)\n`
    );

    let watchUploaded = 0;

    const watcher = chokidar.watch(folder, {
      ignored: [
        /(^|[/\\])\../, // dotfiles (including .bdd-processed.json)
        /\.json$/,
      ],
      persistent: true,
      ignoreInitial: true, // don't fire for files already in folder on start
    });

    watcher.on("add", (filePath: string) => {
      if (uploadLimit !== null && watchUploaded >= uploadLimit) return;
      const beforeSize = processed.size;
      uploadFile(filePath, processed)
        .then(() => {
          if (processed.size > beforeSize) {
            // a new file was successfully uploaded
            watchUploaded++;
            if (uploadLimit !== null && watchUploaded >= uploadLimit) {
              console.log(
                `\n  Limit of ${uploadLimit} reached — stopping watcher.`
              );
              watcher.close().then(() => process.exit(0));
            }
          }
        })
        .catch((err) => console.error(`Unhandled error for ${filePath}:`, err));
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
