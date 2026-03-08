import { NextResponse } from "next/server";
import { auth } from "@/auth";

const publicPaths = ["/", "/login", "/forgot-password", "/reset-password"];
const authApiPath = "/api/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

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

  const session = req.auth;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = session.user.role as string;
  const basePath = pathname.split("/")[1];

  // Role-based redirect: if user visits root dashboard, redirect to role-specific path
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    const rolePaths: Record<string, string> = {
      ADMIN: "/admin",
      MANAGER: "/manager",
      EMPLOYEE: "/employee",
    };
    const redirectTo = rolePaths[role] ?? "/dashboard";
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  // Protect role-specific routes
  if (basePath === "admin" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (basePath === "manager" && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (basePath === "employee" && role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
