import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ─────────────────────────────────────────────────────────────────────────────
// Route protection rules
//
//   /portal/*  → authenticated BUS_OWNER only
//   /admin/*   → authenticated ADMIN only
//   /login     → public
//   /onboard   → public  (bus owner self-registration)
//   /book/*    → public  (passenger booking, no login)
//   /api/*     → handled by auth-guard.ts inside each route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req:    request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // ── Owner portal ───────────────────────────────────────────────────────────
  if (pathname.startsWith("/portal")) {
    if (!token) {
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    if (token.role !== "BUS_OWNER") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return NextResponse.next();
  }

  // ── Admin panel ────────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware only on page routes — API routes are guarded by auth-guard.ts
  matcher: ["/portal/:path*", "/admin/:path*"],
};
