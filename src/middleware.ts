import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that require authentication (staff dashboard)
  const protectedPaths = [
    "/dashboard",
    "/tickets",
    "/clients",
    "/assets",
    "/change-requests",
    "/knowledge",
    "/reports",
    "/settings",
  ];

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Not logged in - redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // CLIENT_USER should not access the staff dashboard - redirect to portal
  if (token.role === "CLIENT_USER") {
    return NextResponse.redirect(new URL("/portal/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tickets/:path*",
    "/clients/:path*",
    "/assets/:path*",
    "/change-requests/:path*",
    "/knowledge/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
