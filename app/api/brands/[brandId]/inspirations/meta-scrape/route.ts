// POST /api/brands/[brandId]/inspirations/meta-scrape
// Scrapes a Meta Ads Library URL and returns up to 15 static ad image URLs (no import).
//
// Strategy (in order):
//   1. Meta Ads Library Graph API — preferred path, no scraping.
//      Token resolution order:
//        a) META_USER_TOKEN env var — a User Access Token with ads_read permission.
//           Generated from Graph API Explorer by an app admin. Valid 60 days.
//           Best for dev/staging while App Review is pending.
//        b) META_APP_ID + META_APP_SECRET — generates a client credential token.
//           Requires the app to have passed Meta's App Review for ads_read permission.
//           Best for production once App Review is approved.
//   2. Puppeteer with network response interception — fallback when Graph API unavailable.
//      Uses `domcontentloaded` + fixed wait; wraps goto in its own try-catch.
//
// NOTE on Vercel: The full `puppeteer` package bundles ~300 MB of Chromium which
// exceeds Vercel's 50 MB function limit. We use:
//   - Development: puppeteer (bundled Chromium, zero config)
//   - Production:  puppeteer-core + @sparticuz/chromium-min (downloads Chromium from S3
//                  into /tmp at runtime — no binary in the function bundle)
// Set CHROMIUM_REMOTE_EXEC_PATH to override the remote Chromium tar URL if needed.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

const MAX_RESULTS = 30;
const META_CDN_RE = /scontent[-\w.]*\.(fbcdn|facebook)\.net/i;
const META_GRAPH_VERSION = "v19.0";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMetaAdsLibraryUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      (u.hostname === "www.facebook.com" || u.hostname === "facebook.com") &&
      u.pathname.startsWith("/ads/library")
    );
  } catch {
    return false;
  }
}

function extractPageId(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.searchParams.get("view_all_page_id") ?? u.searchParams.get("id");
  } catch {
    return null;
  }
}

/**
 * Build a canonical Meta Ads Library URL optimised for image scraping:
 *   - media_type=image_and_meme   → only static images, no videos/reels
 *   - active_status=all           → include paused ads (more content)
 *   - country=ALL                 → worldwide, not just one country
 *   - sort by total_impressions   → best-performing ads first
 *
 * Whatever filters the user had in their original URL are replaced so
 * Puppeteer always lands on the image-only view.
 */
function buildImageOnlyUrl(pageId: string): string {
  const params = new URLSearchParams({
    active_status: "all",
    ad_type: "all",
    country: "ALL",
    is_targeted_country: "false",
    media_type: "image_and_meme",
    search_type: "page",
    "sort_data[mode]": "total_impressions",
    "sort_data[direction]": "desc",
    view_all_page_id: pageId,
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

// CDN type codes that indicate profile/page photos, NOT ad creatives.
// Meta's scontent CDN uses /tX.YYYYY-Z/ path segments to encode asset types:
//   t1.30497-1, t1.6435-1, t1.0-9 → profile pictures / page logos
//   t45.5-23, t39.30808-6         → ad creative images
// Filtering these out removes the brand logo from the result set.
const META_PROFILE_CDN_RE = /\/t1\.\d/;

/**
 * Strip query parameters from a CDN URL to get a stable base path for dedup.
 *
 * Facebook CDN serves the SAME image with different query params on every
 * page load (signing tokens, cache hints, expiry hashes like oh= and oe=).
 * Without this normalisation, the brand's profile picture appears 30 times
 * in the captured URL list — once per ad card — and passes URL-based dedup.
 * By keying the seen-set on the base path we collapse all those duplicates.
 */
function baseUrl(u: string): string {
  const q = u.indexOf("?");
  return q >= 0 ? u.slice(0, q) : u;
}

function dedupeAndFilter(urls: string[]): string[] {
  const seenBase = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const base = baseUrl(u);
    if (seenBase.has(base)) continue;
    seenBase.add(base);
    // Skip profile pics, tiny thumbnails, page logos, UI assets
    if (
      META_PROFILE_CDN_RE.test(u) ||  // brand logos / profile photos (/t1.XXXXX/)
      u.includes("/profile") ||
      u.includes("emoji_") ||
      u.includes("_t.") ||
      u.includes("/rsrc.php")
    ) {
      continue;
    }
    out.push(u);
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

// ── Graph API scrape ──────────────────────────────────────────────────────────
// Uses the Meta Ads Library API. Token resolution:
//   1. META_USER_TOKEN — User Access Token (ads_read scope). No App Review needed.
//      Expires every ~60 days. Renew via Graph API Explorer.
//   2. META_APP_ID + META_APP_SECRET — client credential token (never expires).
//      Requires App Review for ads_read. Only works once Meta approves the app.
// Returns [] if no credentials are available or the call fails.
//
// ad_type handling:
//   - User tokens: support ad_type=IMAGE (server-side filter, clean results)
//   - App tokens:  only support ad_type=ALL — we filter images client-side via
//                  the presence of ad_creative_images on each ad object

async function graphApiScrape(pageId: string): Promise<string[]> {
  let token: string | undefined;
  let isAppToken = false;

  // Path 1: User Access Token (fastest path, no App Review needed)
  const userToken = process.env.META_USER_TOKEN;
  if (userToken) {
    token = userToken;
  } else {
    // Path 2: Client credential token (never expires, requires App Review)
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return [];

    const tokenRes = await fetch(
      `https://graph.facebook.com/oauth/access_token` +
        `?client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&grant_type=client_credentials`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!tokenRes.ok) return [];
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    token = tokenData.access_token;
    isAppToken = true;
  }

  if (!token) return [];

  // App tokens only support ad_type ALL (IMAGE is reserved for user tokens).
  // We get image URLs client-side by checking for the ad_creative_images field.
  const params = new URLSearchParams({
    search_type: "PAGE",
    view_all_page_id: pageId,
    ad_type: isAppToken ? "ALL" : "IMAGE",
    ad_reached_countries: '["US"]',
    fields: "id,ad_creative_images",
    limit: "60",
    access_token: token,
  });

  const adsRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!adsRes.ok) return [];

  const adsData = (await adsRes.json()) as {
    error?: { code: number; error_subcode?: number };
    data?: Array<{ id: string; ad_creative_images?: Array<{ url: string }> }>;
  };

  // Surface known blocking errors to the console for diagnostics
  if (adsData.error) {
    console.error("[meta-scrape] Graph API error:", JSON.stringify(adsData.error));
    return [];
  }

  const imageUrls: string[] = [];
  for (const ad of adsData.data ?? []) {
    // ad_creative_images is only present on image ads — acts as the image filter
    // when using ad_type=ALL (app token path)
    for (const img of ad.ad_creative_images ?? []) {
      if (img.url && META_CDN_RE.test(img.url)) {
        imageUrls.push(img.url);
      }
    }
  }

  return dedupeAndFilter(imageUrls);
}

// ── Puppeteer scrape ──────────────────────────────────────────────────────────
// Uses network response interception to capture images as they are fetched by the
// browser — more reliable than DOM inspection of virtualized React lists.
//
// Browser resolution:
//   - NODE_ENV !== 'production': use full `puppeteer` with bundled Chromium (local dev).
//   - NODE_ENV === 'production': use `puppeteer-core` + `@sparticuz/chromium-min`.
//     chromium-min downloads a compressed Chromium build from S3 into /tmp at runtime,
//     keeping the Vercel function bundle well under the 50 MB limit.

async function launchBrowser() {
  if (process.env.NODE_ENV !== "production") {
    // Local dev: full puppeteer with bundled Chromium
    const puppeteer = await import("puppeteer");
    return puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
      ],
    });
  }

  // Vercel / serverless: puppeteer-core + @sparticuz/chromium-min
  const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
    import("@sparticuz/chromium-min"),
    import("puppeteer-core"),
  ]);

  // Allow overriding the remote Chromium tarball URL via env var
  const remoteUrl =
    process.env.CHROMIUM_REMOTE_EXEC_PATH ??
    "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

  const executablePath = await chromium.executablePath(remoteUrl);

  return puppeteerCore.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
}

async function puppeteerScrape(url: string): Promise<string[]> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // Intercept responses to capture image URLs as they stream in.
    // We collect raw URLs here and filter logos/dupes in dedupeAndFilter().
    const capturedUrls: string[] = [];
    page.on("response", (response) => {
      const resUrl = response.url();
      if (
        META_CDN_RE.test(resUrl) &&
        response.request().resourceType() === "image"
      ) {
        capturedUrls.push(resUrl);
      }
    });

    // domcontentloaded is far more reliable than networkidle2 for Meta's SPA.
    // A navigation timeout here is NOT fatal — the page may have partially loaded
    // and we still get intercepted images.
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    } catch {
      // Partial navigation — continue and use whatever was intercepted
    }

    // Bail early if Meta redirected to login
    const finalUrl = page.url();
    if (finalUrl.includes("/login") || finalUrl.includes("checkpoint")) {
      return [];
    }

    // Wait for initial JS render (reduced from 3s → 2s)
    await new Promise<void>((r) => setTimeout(r, 2_000));

    // Scroll to trigger lazy-loading of more ads; bail early if we already
    // have enough candidate images to fill MAX_RESULTS after filtering.
    for (const delay of [1_000, 800, 800, 600]) {
      if (dedupeAndFilter(capturedUrls).length >= MAX_RESULTS) break;
      await page.evaluate(() => window.scrollBy(0, 900));
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    // Also collect <img> src values from the DOM as a secondary source
    const domSrcs: string[] = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .map((img) => img.src)
          .filter((s) => s.startsWith("http"))
      )
      .catch(() => []);

    await browser.close();

    const allUrls = [
      ...capturedUrls,
      ...domSrcs.filter((s) => META_CDN_RE.test(s)),
    ];

    return dedupeAndFilter(allUrls);
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with a url field." },
      { status: 400 }
    );
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "url field is required." }, { status: 400 });
  }

  if (!isMetaAdsLibraryUrl(rawUrl)) {
    return NextResponse.json(
      {
        error: "invalid_url",
        message:
          "Please provide a valid Meta Ads Library URL (facebook.com/ads/library/…).",
      },
      { status: 422 }
    );
  }

  const pageId = extractPageId(rawUrl);
  if (!pageId) {
    return NextResponse.json(
      {
        error: "missing_page_id",
        message:
          "Could not find a page ID in the URL. Make sure it contains " +
          "view_all_page_id=… or id=… (see instructions above).",
      },
      { status: 422 }
    );
  }

  // ── Try Graph API first (reliable, no scraping) ───────────────────────────────
  let imageUrls: string[] = [];

  try {
    imageUrls = await graphApiScrape(pageId);
  } catch {
    // Graph API unavailable — continue to Puppeteer
  }

  // ── Fall back to Puppeteer ────────────────────────────────────────────────────
  // Use a canonical URL with media_type=image_and_meme + worldwide + sort by impressions
  // instead of the user's original URL (which may have active-only or country filters
  // that reduce the image count significantly).
  if (imageUrls.length === 0) {
    const canonicalUrl = buildImageOnlyUrl(pageId);
    try {
      imageUrls = await puppeteerScrape(canonicalUrl);
    } catch (err) {
      console.error("[meta-scrape] Puppeteer error:", err);
      return NextResponse.json(
        {
          error: "scrape_failed",
          message:
            "Could not load the Meta Ads Library page. This usually means Meta has " +
            "blocked automated access. Try again in a few minutes, or use the " +
            "Import from URL option to add individual ad images manually.",
        },
        { status: 422 }
      );
    }
  }

  if (imageUrls.length === 0) {
    return NextResponse.json(
      {
        error: "no_images_found",
        message:
          "No static ad images were found on that page. The page may require a " +
          "Facebook login to show ads, or there are no active image ads for this " +
          "account. Use Import from URL to add images individually.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ imageUrls });
}
