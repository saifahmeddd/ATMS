import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

/**
 * Requires authenticated session. Returns 401 if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

/**
 * Requires Admin role. Returns 403 if not admin.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  return session;
}

/**
 * Requires Manager role. Returns 403 if not manager.
 */
export async function requireManager() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  if (session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden: Manager access required" }, { status: 403 });
  }
  return session;
}

/**
 * Requires Employee role. Returns 403 if not employee.
 */
export async function requireEmployee() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  if (session.user.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden: Employee access required" }, { status: 403 });
  }
  return session;
}

/**
 * Requires Admin or Manager role.
 */
export async function requireAdminOrManager() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden: Admin or Manager access required" }, { status: 403 });
  }
  return session;
}
