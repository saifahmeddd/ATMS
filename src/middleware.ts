import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = ["/", "/login", "/forgot-password", "/reset-password"];
const authApiPath = "/api/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Allow auth API
  if (pathname.startsWith(authApiPath)) {
    return NextResponse.next();
  }

  // Allow cron API (called externally without auth)
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // Allow public certificate verification (no auth required)
  if (pathname === "/api/verify-certificate") {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // API routes should return 401 JSON, not a redirect to login page
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = token.role as string;
  const basePath = pathname.split("/")[1];

  // Role-based redirect: if user visits root dashboard, redirect to role-specific path
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    const rolePaths: Record<string, string> = {
      ADMIN: "/admin",
      MANAGER: "/manager",
      EMPLOYEE: "/employee",
    };
    const redirectTo = rolePaths[role] ?? "/dashboard";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Protect role-specific routes
  if (basePath === "admin" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (basePath === "manager" && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (basePath === "employee" && role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
