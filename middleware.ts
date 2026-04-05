import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/review/")) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new NextResponse("Method Not Allowed", { status: 405 });
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/review/:path*"],
};
