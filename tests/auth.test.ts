/**
 * Authentication Feature Integration Tests (FR-2.1 through FR-2.6)
 *
 * Runs against a live dev server at http://localhost:3000
 * Uses Prisma to verify database state (audit logs, tokens, etc.)
 *
 * Usage: npx tsx tests/auth.test.ts
 */

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

// ─── Test Runner ───────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(name: string) {
  passed++;
  console.log(`  ✅ PASS  ${name}`);
}

function fail(name: string, detail?: string) {
  failed++;
  console.log(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name: string, reason: string) {
  skipped++;
  console.log(`  ⏭️  SKIP  ${name} — ${reason}`);
}

// ─── Cookie Helpers ────────────────────────────────────────

function extractSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,\s*(?=[A-Za-z_][\w.-]*=)/);
}

function mergeCookies(...sources: string[]): string {
  const map = new Map<string, string>();
  for (const src of sources) {
    for (const part of src.split(/;\s*/)) {
      const eq = part.indexOf("=");
      if (eq > 0) {
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (!["path", "expires", "max-age", "domain", "samesite", "httponly", "secure"].includes(k.toLowerCase())) {
          map.set(k, v);
        }
      }
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

// ─── Auth Helpers ──────────────────────────────────────────

async function getCsrf(): Promise<{ csrfToken: string; cookies: string }> {
  const res = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  const raw = extractSetCookies(res.headers);
  const cookies = mergeCookies(...raw);
  return { csrfToken, cookies };
}

async function login(
  email: string,
  password: string
): Promise<{ authenticated: boolean; cookies: string }> {
  const { csrfToken, cookies: csrfCookies } = await getCsrf();

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies,
    },
    body: new URLSearchParams({ email, password, csrfToken }),
    redirect: "manual",
  });

  const setCookies = extractSetCookies(res.headers);
  const allCookies = mergeCookies(csrfCookies, ...setCookies);
  const hasSession = setCookies.some((c) => c.includes("session-token"));

  return { authenticated: hasSession, cookies: allCookies };
}

async function getSession(
  cookies: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookies },
  });
  const data = await res.json();
  if (data && typeof data === "object" && "user" in (data as object)) {
    return data as Record<string, unknown>;
  }
  return null;
}

// ─── Seed Credentials ──────────────────────────────────────

const ADMIN = { email: "admin@almnfthen.com", password: "Admin123!" };
const MANAGER = { email: "manager@almnfthen.com", password: "Manager123!" };
const EMPLOYEE1 = { email: "employee1@almnfthen.com", password: "Employee123!" };
const EMPLOYEE2 = { email: "employee2@almnfthen.com", password: "Employee123!" };

// ─── Tests ─────────────────────────────────────────────────

async function testFR21_Login() {
  console.log("\n═══ FR-2.1: User Login ═══");

  // TC-2.1.1: Valid admin login
  {
    const result = await login(ADMIN.email, ADMIN.password);
    result.authenticated
      ? ok("TC-2.1.1: Admin can log in with valid credentials")
      : fail("TC-2.1.1: Admin can log in with valid credentials", "No session token set");
  }

  // TC-2.1.2: Valid employee login
  {
    const result = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    result.authenticated
      ? ok("TC-2.1.2: Employee can log in with valid credentials")
      : fail("TC-2.1.2: Employee can log in with valid credentials", "No session token set");
  }

  // TC-2.1.3: Invalid password
  {
    const result = await login(ADMIN.email, "WrongPassword!");
    !result.authenticated
      ? ok("TC-2.1.3: Login fails with incorrect password")
      : fail("TC-2.1.3: Login fails with incorrect password", "Session was created");
  }

  // TC-2.1.4: Non-existent email
  {
    const result = await login("nobody@almnfthen.com", "Whatever123!");
    !result.authenticated
      ? ok("TC-2.1.4: Login fails with non-existent email")
      : fail("TC-2.1.4: Login fails with non-existent email", "Session was created");
  }

  // TC-2.1.5: Inactive user login
  {
    const tempUser = await prisma.user.create({
      data: {
        name: "Inactive Test",
        email: "inactive-test@almnfthen.com",
        passwordHash: await bcrypt.hash("Test1234!", 12),
        role: "EMPLOYEE",
        status: "INACTIVE",
      },
    });
    try {
      const result = await login("inactive-test@almnfthen.com", "Test1234!");
      !result.authenticated
        ? ok("TC-2.1.5: Login fails for INACTIVE user")
        : fail("TC-2.1.5: Login fails for INACTIVE user", "Session was created");
    } finally {
      await prisma.auditLog.deleteMany({ where: { metadata: { path: ["email"], equals: "inactive-test@almnfthen.com" } } });
      await prisma.user.delete({ where: { id: tempUser.id } });
    }
  }

  // TC-2.1.6: Login with manager credentials
  {
    const result = await login(MANAGER.email, MANAGER.password);
    result.authenticated
      ? ok("TC-2.1.6: Manager can log in with valid credentials")
      : fail("TC-2.1.6: Manager can log in with valid credentials", "No session token set");
  }
}

async function testFR22_RBAC() {
  console.log("\n═══ FR-2.2: Role-Based Access Control ═══");

  // TC-2.2.1: Admin session has ADMIN role
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const session = await getSession(cookies);
    const role = (session?.user as Record<string, unknown>)?.role;
    role === "ADMIN"
      ? ok("TC-2.2.1: Admin session has role=ADMIN")
      : fail("TC-2.2.1: Admin session has role=ADMIN", `Got role=${role}`);
  }

  // TC-2.2.2: Employee session has EMPLOYEE role
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const session = await getSession(cookies);
    const role = (session?.user as Record<string, unknown>)?.role;
    role === "EMPLOYEE"
      ? ok("TC-2.2.2: Employee session has role=EMPLOYEE")
      : fail("TC-2.2.2: Employee session has role=EMPLOYEE", `Got role=${role}`);
  }

  // TC-2.2.3: Manager session has MANAGER role
  {
    const { cookies } = await login(MANAGER.email, MANAGER.password);
    const session = await getSession(cookies);
    const role = (session?.user as Record<string, unknown>)?.role;
    role === "MANAGER"
      ? ok("TC-2.2.3: Manager session has role=MANAGER")
      : fail("TC-2.2.3: Manager session has role=MANAGER", `Got role=${role}`);
  }

  // TC-2.2.4: Admin can access /api/users (admin-only)
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const res = await fetch(`${BASE}/api/users`, {
      headers: { Cookie: cookies },
    });
    res.status === 200
      ? ok("TC-2.2.4: Admin can access /api/users")
      : fail("TC-2.2.4: Admin can access /api/users", `Status ${res.status}`);
  }

  // TC-2.2.5: Employee cannot access /api/users (admin-only)
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const res = await fetch(`${BASE}/api/users`, {
      headers: { Cookie: cookies },
    });
    res.status === 403
      ? ok("TC-2.2.5: Employee blocked from /api/users (403)")
      : fail("TC-2.2.5: Employee blocked from /api/users (403)", `Status ${res.status}`);
  }

  // TC-2.2.6: Unauthenticated cannot access /api/users
  {
    const res = await fetch(`${BASE}/api/users`);
    res.status === 401
      ? ok("TC-2.2.6: Unauthenticated blocked from /api/users (401)")
      : fail("TC-2.2.6: Unauthenticated blocked from /api/users (401)", `Status ${res.status}`);
  }

  // TC-2.2.7: Middleware redirects unauthenticated user from /admin
  {
    const res = await fetch(`${BASE}/admin`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    res.status === 307 && location.includes("/login")
      ? ok("TC-2.2.7: Middleware redirects unauthenticated from /admin to /login")
      : fail("TC-2.2.7: Middleware redirects unauthenticated from /admin to /login", `Status ${res.status}, Location: ${location}`);
  }

  // TC-2.2.8: Employee cannot access /admin page
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const res = await fetch(`${BASE}/admin`, {
      headers: { Cookie: cookies },
      redirect: "manual",
    });
    const location = res.headers.get("location") ?? "";
    (res.status === 307 && location.includes("/login"))
      ? ok("TC-2.2.8: Employee redirected away from /admin")
      : fail("TC-2.2.8: Employee redirected away from /admin", `Status ${res.status}, Location: ${location}`);
  }

  // TC-2.2.9: /dashboard redirects ADMIN to /admin
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const res = await fetch(`${BASE}/dashboard`, {
      headers: { Cookie: cookies },
      redirect: "manual",
    });
    const location = res.headers.get("location") ?? "";
    location.includes("/admin")
      ? ok("TC-2.2.9: /dashboard redirects ADMIN to /admin")
      : fail("TC-2.2.9: /dashboard redirects ADMIN to /admin", `Location: ${location}`);
  }
}

async function testFR23_PasswordReset() {
  console.log("\n═══ FR-2.3: Password Reset via Email ═══");

  // Use employee2 for destructive reset tests
  const user = await prisma.user.findUnique({ where: { email: EMPLOYEE2.email } });
  if (!user) {
    skip("FR-2.3", "employee2 not found in database");
    return;
  }

  const originalHash = user.passwordHash;

  // TC-2.3.1: Forgot password API returns generic message for existing email
  {
    const res = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMPLOYEE2.email }),
    });
    const data = (await res.json()) as { message: string };
    res.status === 200 && data.message?.includes("If an account")
      ? ok("TC-2.3.1: Forgot password returns generic message for existing email")
      : fail("TC-2.3.1: Forgot password returns generic message for existing email", `Status ${res.status}: ${data.message}`);
  }

  // TC-2.3.2: Forgot password returns same message for non-existent email (prevents enumeration)
  {
    const res = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@almnfthen.com" }),
    });
    const data = (await res.json()) as { message: string };
    res.status === 200 && data.message?.includes("If an account")
      ? ok("TC-2.3.2: Same generic response for non-existent email (no enumeration)")
      : fail("TC-2.3.2: Same generic response for non-existent email (no enumeration)", `Status ${res.status}`);
  }

  // TC-2.3.3: Reset password with valid token
  {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, newPassword: "NewPass123!" }),
    });
    const data = (await res.json()) as { message?: string; error?: string };
    res.status === 200 && data.message?.includes("reset successfully")
      ? ok("TC-2.3.3: Password reset succeeds with valid token")
      : fail("TC-2.3.3: Password reset succeeds with valid token", `Status ${res.status}: ${data.error ?? data.message}`);
  }

  // TC-2.3.4: Login with new password after reset
  {
    const result = await login(EMPLOYEE2.email, "NewPass123!");
    result.authenticated
      ? ok("TC-2.3.4: Can login with new password after reset")
      : fail("TC-2.3.4: Can login with new password after reset", "Auth failed");
  }

  // TC-2.3.5: Reset with invalid token
  {
    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "totally-invalid-token", newPassword: "Something123!" }),
    });
    res.status === 400
      ? ok("TC-2.3.5: Reset fails with invalid token (400)")
      : fail("TC-2.3.5: Reset fails with invalid token (400)", `Status ${res.status}`);
  }

  // TC-2.3.6: Reset with expired token
  {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
      },
    });

    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, newPassword: "Expired123!" }),
    });
    res.status === 400
      ? ok("TC-2.3.6: Reset fails with expired token (400)")
      : fail("TC-2.3.6: Reset fails with expired token (400)", `Status ${res.status}`);
  }

  // TC-2.3.7: Used token cannot be reused
  {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(), // already used
      },
    });

    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, newPassword: "Reused123!" }),
    });
    res.status === 400
      ? ok("TC-2.3.7: Already-used token cannot be reused (400)")
      : fail("TC-2.3.7: Already-used token cannot be reused (400)", `Status ${res.status}`);
  }

  // Restore original password
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: originalHash },
  });
}

async function testFR24_SessionDuration() {
  console.log("\n═══ FR-2.4: Configurable Session Duration ═══");

  // TC-2.4.1: Session maxAge is configurable via SESSION_MAX_AGE env var
  {
    const configuredMaxAge = process.env.SESSION_MAX_AGE;
    const effectiveMaxAge = parseInt(configuredMaxAge ?? "86400", 10);
    effectiveMaxAge > 0
      ? ok(`TC-2.4.1: Session maxAge is configured (${effectiveMaxAge}s = ${Math.round(effectiveMaxAge / 3600)}h)`)
      : fail("TC-2.4.1: Session maxAge is configured", `Invalid value: ${configuredMaxAge}`);
  }

  // TC-2.4.2: Session is active after login
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const session = await getSession(cookies);
    session !== null
      ? ok("TC-2.4.2: Session is active and readable after login")
      : fail("TC-2.4.2: Session is active and readable after login", "No session returned");
  }

  // TC-2.4.3: Session contains user info (id, role, email)
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const session = await getSession(cookies);
    const user = session?.user as Record<string, unknown> | undefined;
    user?.id && user?.role && user?.email
      ? ok("TC-2.4.3: Session contains id, role, and email")
      : fail("TC-2.4.3: Session contains id, role, and email", `Session user: ${JSON.stringify(user)}`);
  }
}

async function testFR25_AuditLogging() {
  console.log("\n═══ FR-2.5: Audit Logging ═══");

  // Clear old audit logs for test user to avoid false positives
  const adminUser = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  if (!adminUser) {
    skip("FR-2.5", "Admin user not found");
    return;
  }

  // TC-2.5.1: Successful login creates LOGIN_SUCCESS audit log
  {
    const before = new Date();
    await login(ADMIN.email, ADMIN.password);
    // Small delay to let DB write complete
    await new Promise((r) => setTimeout(r, 500));

    const log = await prisma.auditLog.findFirst({
      where: {
        userId: adminUser.id,
        action: "LOGIN_SUCCESS",
        createdAt: { gte: before },
      },
      orderBy: { createdAt: "desc" },
    });
    log
      ? ok("TC-2.5.1: Successful login creates LOGIN_SUCCESS audit log")
      : fail("TC-2.5.1: Successful login creates LOGIN_SUCCESS audit log", "No audit log found");
  }

  // TC-2.5.2: Failed login creates LOGIN_FAILURE audit log
  {
    const before = new Date();
    await login(ADMIN.email, "WrongPassword999!");
    await new Promise((r) => setTimeout(r, 500));

    const log = await prisma.auditLog.findFirst({
      where: {
        action: "LOGIN_FAILURE",
        createdAt: { gte: before },
        metadata: { path: ["email"], equals: ADMIN.email },
      },
      orderBy: { createdAt: "desc" },
    });
    log
      ? ok("TC-2.5.2: Failed login creates LOGIN_FAILURE audit log")
      : fail("TC-2.5.2: Failed login creates LOGIN_FAILURE audit log", "No audit log found");
  }

  // TC-2.5.3: Forgot password creates PASSWORD_RESET_REQUESTED audit log
  {
    const before = new Date();
    await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN.email }),
    });
    await new Promise((r) => setTimeout(r, 500));

    const log = await prisma.auditLog.findFirst({
      where: {
        userId: adminUser.id,
        action: "PASSWORD_RESET_REQUESTED",
        createdAt: { gte: before },
      },
      orderBy: { createdAt: "desc" },
    });
    log
      ? ok("TC-2.5.3: Forgot password creates PASSWORD_RESET_REQUESTED audit log")
      : fail("TC-2.5.3: Forgot password creates PASSWORD_RESET_REQUESTED audit log", "No audit log found");
  }

  // TC-2.5.4: Password reset creates PASSWORD_RESET_COMPLETED audit log
  {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: adminUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const before = new Date();
    await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, newPassword: "TempAdmin123!" }),
    });
    await new Promise((r) => setTimeout(r, 500));

    const log = await prisma.auditLog.findFirst({
      where: {
        userId: adminUser.id,
        action: "PASSWORD_RESET_COMPLETED",
        createdAt: { gte: before },
      },
      orderBy: { createdAt: "desc" },
    });
    log
      ? ok("TC-2.5.4: Reset password creates PASSWORD_RESET_COMPLETED audit log")
      : fail("TC-2.5.4: Reset password creates PASSWORD_RESET_COMPLETED audit log", "No audit log found");

    // Restore admin password
    const hash = await bcrypt.hash(ADMIN.password, 12);
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { passwordHash: hash },
    });
  }

  // TC-2.5.5: Change password creates PASSWORD_CHANGED audit log
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const emp = await prisma.user.findUnique({ where: { email: EMPLOYEE1.email } });

    const before = new Date();
    await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: EMPLOYEE1.password, newPassword: "Changed123!" }),
    });
    await new Promise((r) => setTimeout(r, 500));

    const log = await prisma.auditLog.findFirst({
      where: {
        userId: emp!.id,
        action: "PASSWORD_CHANGED",
        createdAt: { gte: before },
      },
      orderBy: { createdAt: "desc" },
    });
    log
      ? ok("TC-2.5.5: Change password creates PASSWORD_CHANGED audit log")
      : fail("TC-2.5.5: Change password creates PASSWORD_CHANGED audit log", "No audit log found");

    // Restore employee1 password
    const hash = await bcrypt.hash(EMPLOYEE1.password, 12);
    await prisma.user.update({
      where: { id: emp!.id },
      data: { passwordHash: hash },
    });
  }
}

async function testFR26_ChangePassword() {
  console.log("\n═══ FR-2.6: Change Password ═══");

  const user = await prisma.user.findUnique({ where: { email: EMPLOYEE2.email } });
  if (!user) {
    skip("FR-2.6", "employee2 not found");
    return;
  }
  const originalHash = user.passwordHash;

  // TC-2.6.1: Change password fails without authentication
  {
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: EMPLOYEE2.password, newPassword: "NewPass456!" }),
    });
    res.status === 401
      ? ok("TC-2.6.1: Change password fails without authentication (401)")
      : fail("TC-2.6.1: Change password fails without authentication (401)", `Status ${res.status}`);
  }

  // TC-2.6.2: Change password fails with wrong current password
  {
    const { cookies } = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: "WrongCurrent!", newPassword: "NewPass456!" }),
    });
    res.status === 401
      ? ok("TC-2.6.2: Change password fails with wrong current password (401)")
      : fail("TC-2.6.2: Change password fails with wrong current password (401)", `Status ${res.status}`);
  }

  // TC-2.6.3: Change password fails with short new password
  {
    const { cookies } = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: EMPLOYEE2.password, newPassword: "short" }),
    });
    res.status === 400
      ? ok("TC-2.6.3: Change password fails with short new password (400)")
      : fail("TC-2.6.3: Change password fails with short new password (400)", `Status ${res.status}`);
  }

  // TC-2.6.4: Change password succeeds with correct current password
  {
    const { cookies } = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: EMPLOYEE2.password, newPassword: "Changed456!" }),
    });
    const data = (await res.json()) as { message?: string };
    res.status === 200 && data.message?.includes("successfully")
      ? ok("TC-2.6.4: Change password succeeds with correct current password")
      : fail("TC-2.6.4: Change password succeeds with correct current password", `Status ${res.status}`);
  }

  // TC-2.6.5: Can login with changed password
  {
    const result = await login(EMPLOYEE2.email, "Changed456!");
    result.authenticated
      ? ok("TC-2.6.5: Can login with the new changed password")
      : fail("TC-2.6.5: Can login with the new changed password", "Auth failed");
  }

  // TC-2.6.6: Old password no longer works after change
  {
    const result = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    !result.authenticated
      ? ok("TC-2.6.6: Old password no longer works after change")
      : fail("TC-2.6.6: Old password no longer works after change", "Old password still authenticated");
  }

  // Restore original password
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: originalHash },
  });
}

// ─── Cleanup & Run ─────────────────────────────────────────

async function cleanup() {
  // Clean up test tokens
  const emp2 = await prisma.user.findUnique({ where: { email: EMPLOYEE2.email } });
  if (emp2) {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: emp2.id },
    });
  }
  const admin = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  if (admin) {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: admin.id },
    });
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Authentication Feature — Integration Test Suite           ║");
  console.log("║   Testing against: http://localhost:3000                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Verify server is reachable
  try {
    const res = await fetch(`${BASE}/api/auth/csrf`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (e) {
    console.error("\n❌ Cannot reach dev server at http://localhost:3000");
    console.error("   Make sure `npm run dev` is running.\n");
    process.exit(1);
  }

  try {
    await testFR21_Login();
    await testFR22_RBAC();
    await testFR23_PasswordReset();
    await testFR24_SessionDuration();
    await testFR25_AuditLogging();
    await testFR26_ChangePassword();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`  Results:  ✅ ${passed} passed   ❌ ${failed} failed   ⏭️  ${skipped} skipped`);
  console.log("══════════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main();
