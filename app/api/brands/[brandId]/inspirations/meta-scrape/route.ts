// POST /api/brands/[brandId]/inspirations/meta-scrape
// Puppeteer headless scrape of a Meta Ads Library URL.
// Returns up to 15 candidate static ad image URLs. Does NOT import — that's meta-import.
//
// NOTE: Puppeteer ships with a bundled Chromium (~300MB) that may exceed Vercel's 50MB
// serverless function limit. If that becomes an issue in production, proxy this route through
// a Railway server using puppeteer-core + @sparticuz/chromium instead.
//
// Constraints:
//   - Only accepts facebook.com/ads/library URLs
//   - Filters to Meta CDN image URLs (scontent*.fbcdn.net)
//   - Returns at most 15 unique image URLs
//   - Graceful fallback on scraping failure → friendly error

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import puppeteer from "puppeteer";

// Longer timeout needed for Puppeteer
export const maxDuration = 60;

const MAX_RESULTS = 15;

// Meta ad image CDN — scontent-*.fbcdn.net or scontent.fbcdn.net
const META_CDN_RE = /scontent[-\w.]*\.(fbcdn|facebook)\.net/i;

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
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

  // ── Parse body ────────────────────────────────────────────────────────────────
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

  // ── Puppeteer scrape ──────────────────────────────────────────────────────────
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
      ],
    });

    const page = await browser.newPage();

    // Realistic browser fingerprint to reduce bot detection
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // Navigate to Meta Ads Library
    await page.goto(rawUrl, { waitUntil: "networkidle2", timeout: 30_000 });

    // Wait for ad image content to appear (up to 10s)
    await page
      .waitForSelector('img[src*="scontent"]', { timeout: 10_000 })
      .catch(() => {
        // No images found within timeout — continue and collect whatever is there
      });

    // Scroll down to trigger lazy loading of more ads
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    // Collect all <img> src values from the page
    const allImgSrcs: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter((src) => src.startsWith("http"))
    );

    // Keep only Meta CDN images (actual ad content)
    const metaImages = allImgSrcs.filter((src) => META_CDN_RE.test(src));

    // Deduplicate and remove likely non-ad images (profile pics, icons, emoji)
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const src of metaImages) {
      if (seen.has(src)) continue;
      seen.add(src);
      // Skip obvious non-ad images
      if (
        src.includes("/profile") ||
        src.includes("emoji_") ||
        src.includes("_t.") || // tiny thumbnails
        src.includes("/rsrc.php") // static UI assets
      ) {
        continue;
      }
      filtered.push(src);
      if (filtered.length >= MAX_RESULTS) break;
    }

    if (filtered.length === 0) {
      return NextResponse.json(
        {
          error: "no_images_found",
          message:
            "No static ad images found at that URL. Meta may have blocked automated access, " +
            "or the page may require a login. Try again or use the manual Import from URL option.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ imageUrls: filtered });
  } catch (err) {
    console.error("[meta-scrape] Puppeteer error:", err);
    return NextResponse.json(
      {
        error: "scrape_failed",
        message:
          "Could not scrape the Meta Ads Library page. Meta may have blocked automated access. " +
          "Try again in a few minutes, or use the manual Import from URL option.",
      },
      { status: 422 }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore close errors
      }
    }
  }
}
