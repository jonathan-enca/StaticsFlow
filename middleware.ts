// Route protection middleware using Auth.js v5
// Public routes: /, /login, /signup, /api/auth/*
// Everything else requires authentication

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow all /api/auth/* routes (NextAuth internals)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow public marketing / static paths
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (!req.auth && !isPublic) {
    // Redirect unauthenticated users to login, preserving the intended URL
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
  // Run on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
