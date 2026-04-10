// Route protection middleware — Edge runtime compatible
// Uses the edge-safe auth config (no bcrypt/Prisma) to validate JWT sessions.
// Public routes: /, /login, /signup, /onboarding
// Onboarding APIs (brand extract + creative generate) are public for the "wow moment"
// Everything else requires authentication.

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/", "/login", "/signup", "/onboarding"];

// API routes accessible without auth (onboarding "wow moment" flow)
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/brands/extract",
  "/api/onboarding",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public API routes
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow public page routes and static assets
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already-authenticated users away from login/signup
  if (req.auth && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
