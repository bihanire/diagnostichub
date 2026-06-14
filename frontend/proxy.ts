import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/admin", "/cases", "/triage", "/result", "/playbook", "/sop", "/profile", "/"];
const AUTH_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get("dh_auth");

  // Exact "/" must match exactly, not as prefix (would catch everything)
  const isProtected =
    pathname === "/" ||
    PROTECTED_PATHS.filter((p) => p !== "/").some((p) => pathname.startsWith(p));

  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected && !authCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && authCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/admin/:path*",
    "/cases/:path*",
    "/triage/:path*",
    "/result/:path*",
    "/playbook/:path*",
    "/sop/:path*",
    "/sop",
    "/profile/:path*",
    "/profile",
    "/login",
    "/register",
    "/pending",
  ],
};
