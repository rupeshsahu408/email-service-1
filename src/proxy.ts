import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/constants";

/**
 * Routes that must stay reachable without a session cookie (auth flows, inbound
 * webhooks, token-gated confidential viewer).
 */
function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/c/")) return true;

  if (pathname.startsWith("/api/confidential/")) return true;

  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/admin/auth/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname === "/api/razorpay/webhook") return true;
  if (pathname === "/api/health") return true;

  const authPages = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/privacy-policy",
    "/terms",
    "/about",
    "/contact",
    "/help",
    "/security",
    "/learn-more",
  ];
  return authPages.includes(pathname);
}

function isPublicAsset(pathname: string): boolean {
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return true;
  }
  return /\.(ico|png|jpg|jpeg|gif|webp|svg|txt|xml|json|woff2?)$/i.test(
    pathname
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get(SESSION_COOKIE)?.value ||
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    const returnTo =
      pathname + request.nextUrl.search + request.nextUrl.hash;
    login.searchParams.set("next", returnTo || "/inbox");
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
