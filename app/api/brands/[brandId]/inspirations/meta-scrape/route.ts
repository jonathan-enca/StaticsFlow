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
// NOTE on Vercel: Puppeteer bundles ~300 MB of Chromium which exceeds Vercel's 50 MB
// function limit. The Graph API path has no binary-size issue (plain fetch only).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import puppeteer from "puppeteer";

export const maxDuration = 60;

const MAX_RESULTS = 15;
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

function dedupeAndFilter(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    // Skip profile pics, tiny thumbnails, UI assets
    if (
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
//   2. META_APP_ID + META_APP_SECRET — client credential token. Requires App Review.
// Returns [] if no credentials are available or the call fails.

async function graphApiScrape(pageId: string): Promise<string[]> {
  let token: string | undefined;

  // Path 1: User Access Token (fastest path, no App Review needed)
  const userToken = process.env.META_USER_TOKEN;
  if (userToken) {
    token = userToken;
  } else {
    // Path 2: Client credential token (requires App Review for ads_read)
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
  }

  if (!token) return [];

  // Query the Ads Library API for image ads from this page
  const params = new URLSearchParams({
    search_type: "PAGE",
    view_all_page_id: pageId,
    ad_type: "ALL",
    ad_reached_countries: '["US"]',
    fields: "id,ad_creative_images",
    limit: "30",
    access_token: token,
  });

  const adsRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!adsRes.ok) return [];

  const adsData = (await adsRes.json()) as {
    data?: Array<{ id: string; ad_creative_images?: Array<{ url: string }> }>;
  };

  const imageUrls: string[] = [];
  for (const ad of adsData.data ?? []) {
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

async function puppeteerScrape(url: string): Promise<string[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // Intercept responses to capture image URLs as they stream in
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
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch {
      // Partial navigation — continue and use whatever was intercepted
    }

    // Bail early if Meta redirected to login
    const finalUrl = page.url();
    if (finalUrl.includes("/login") || finalUrl.includes("checkpoint")) {
      return [];
    }

    // Wait for initial JS render
    await new Promise<void>((r) => setTimeout(r, 3_000));

    // Scroll to trigger lazy-loading of more ads
    await page.evaluate(() => window.scrollBy(0, 700));
    await new Promise<void>((r) => setTimeout(r, 1_500));
    await page.evaluate(() => window.scrollBy(0, 700));
    await new Promise<void>((r) => setTimeout(r, 1_000));

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
  if (imageUrls.length === 0) {
    try {
      imageUrls = await puppeteerScrape(rawUrl);
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
