import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["zh-cn", "en-us"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "zh-cn";

const isLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/tools" || pathname === "/tools/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}`;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/tools/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/service-worker.js" ||
    pathname === "/offline.html" ||
    pathname.startsWith("/public/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0]!)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"],
};
