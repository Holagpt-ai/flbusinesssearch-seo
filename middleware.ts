import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export default function middleware(request: NextRequest) {
  // Admin Basic Auth guard
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const authHeader = request.headers.get("authorization");
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return new Response("ADMIN_PASSWORD env var not set", { status: 500 });
    }

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="FLBusinessSearch Admin"' },
      });
    }

    const base64 = authHeader.slice("Basic ".length);
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const [, password] = decoded.split(":");

    if (password !== adminPassword) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="FLBusinessSearch Admin"' },
      });
    }

    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (pathname === "/privacy" || pathname === "/terms") {
    return NextResponse.rewrite(new URL(`/en${pathname}`, request.url));
  }

  // Spanish search path: /es/buscar → /es/search
  // Rewrite the pathname then let intlMiddleware set locale context correctly
  if (pathname === "/es/buscar") {
    const url = request.nextUrl.clone();
    url.pathname = "/es/search";
    const rewrittenRequest = new NextRequest(url, request);
    const intlResponse = intlMiddleware(rewrittenRequest);
    const rewriteResponse = NextResponse.rewrite(url, { headers: intlResponse.headers });
    return rewriteResponse;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/admin/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
