/**
 * Full Integration Test Suite — FR-1.x (User Management) + FR-2.x (Auth)
 *
 * Runs against a live dev server at http://localhost:3000
 * Usage: npx tsx tests/full.test.ts
 */

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

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

// ─── Cookie / Auth Helpers ─────────────────────────────────

function extractSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
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

async function getCsrf(): Promise<{ csrfToken: string; cookies: string }> {
  const res = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  const raw = extractSetCookies(res.headers);
  return { csrfToken, cookies: mergeCookies(...raw) };
}

async function login(email: string, password: string): Promise<{ authenticated: boolean; cookies: string }> {
  const { csrfToken, cookies: csrfCookies } = await getCsrf();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookies },
    body: new URLSearchParams({ email, password, csrfToken }),
    redirect: "manual",
  });
  const setCookies = extractSetCookies(res.headers);
  const allCookies = mergeCookies(csrfCookies, ...setCookies);
  const hasSession = setCookies.some((c) => c.includes("session-token"));
  return { authenticated: hasSession, cookies: allCookies };
}

async function getSession(cookies: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookies } });
  const data = await res.json();
  return data && typeof data === "object" && "user" in (data as object) ? data as Record<string, unknown> : null;
}

const ADMIN = { email: "admin@almnfthen.com", password: "Admin123!" };
const MANAGER = { email: "manager@almnfthen.com", password: "Manager123!" };
const EMPLOYEE1 = { email: "employee1@almnfthen.com", password: "Employee123!" };
const EMPLOYEE2 = { email: "employee2@almnfthen.com", password: "Employee123!" };

// ─── FR-2.1: Login ─────────────────────────────────────────

async function testFR21() {
  console.log("\n═══ FR-2.1: User Login ═══");

  {
    const r = await login(ADMIN.email, ADMIN.password);
    r.authenticated ? ok("TC-2.1.1: Admin login succeeds") : fail("TC-2.1.1: Admin login succeeds");
  }
  {
    const r = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    r.authenticated ? ok("TC-2.1.2: Employee login succeeds") : fail("TC-2.1.2: Employee login succeeds");
  }
  {
    const r = await login(MANAGER.email, MANAGER.password);
    r.authenticated ? ok("TC-2.1.3: Manager login succeeds") : fail("TC-2.1.3: Manager login succeeds");
  }
  {
    const r = await login(ADMIN.email, "WrongPassword!");
    !r.authenticated ? ok("TC-2.1.4: Wrong password rejected") : fail("TC-2.1.4: Wrong password rejected");
  }
  {
    const r = await login("nobody@test.com", "Whatever!");
    !r.authenticated ? ok("TC-2.1.5: Non-existent email rejected") : fail("TC-2.1.5: Non-existent email rejected");
  }
  {
    const u = await prisma.user.create({
      data: { name: "Inactive", email: "inactive-test@test.com", passwordHash: await bcrypt.hash("Test1234!", 12), role: "EMPLOYEE", status: "INACTIVE" },
    });
    try {
      const r = await login("inactive-test@test.com", "Test1234!");
      !r.authenticated ? ok("TC-2.1.6: Inactive user rejected") : fail("TC-2.1.6: Inactive user rejected");
    } finally {
      await prisma.auditLog.deleteMany({ where: { metadata: { path: ["email"], equals: "inactive-test@test.com" } } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }
}

// ─── FR-2.2: RBAC ──────────────────────────────────────────

async function testFR22() {
  console.log("\n═══ FR-2.2: Role-Based Access Control ═══");

  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const s = await getSession(cookies);
    (s?.user as Record<string, unknown>)?.role === "ADMIN"
      ? ok("TC-2.2.1: Admin session role=ADMIN") : fail("TC-2.2.1: Admin session role=ADMIN");
  }
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const s = await getSession(cookies);
    (s?.user as Record<string, unknown>)?.role === "EMPLOYEE"
      ? ok("TC-2.2.2: Employee session role=EMPLOYEE") : fail("TC-2.2.2: Employee session role=EMPLOYEE");
  }
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const r = await fetch(`${BASE}/api/users`, { headers: { Cookie: cookies } });
    r.status === 200 ? ok("TC-2.2.3: Admin can GET /api/users") : fail("TC-2.2.3: Admin can GET /api/users", `${r.status}`);
  }
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const r = await fetch(`${BASE}/api/users`, { headers: { Cookie: cookies } });
    r.status === 403 ? ok("TC-2.2.4: Employee blocked from /api/users (403)") : fail("TC-2.2.4: Employee blocked from /api/users (403)", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/users`);
    r.status === 401 ? ok("TC-2.2.5: Unauthenticated blocked (401)") : fail("TC-2.2.5: Unauthenticated blocked (401)", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/admin`, { redirect: "manual" });
    const loc = r.headers.get("location") ?? "";
    r.status === 307 && loc.includes("/login")
      ? ok("TC-2.2.6: Unauthenticated redirect /admin -> /login") : fail("TC-2.2.6: Unauthenticated redirect /admin -> /login", `${r.status} ${loc}`);
  }
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const r = await fetch(`${BASE}/admin`, { headers: { Cookie: cookies }, redirect: "manual" });
    const loc = r.headers.get("location") ?? "";
    r.status === 307 && loc.includes("/login")
      ? ok("TC-2.2.7: Employee redirected from /admin") : fail("TC-2.2.7: Employee redirected from /admin", `${r.status} ${loc}`);
  }
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const r = await fetch(`${BASE}/dashboard`, { headers: { Cookie: cookies }, redirect: "manual" });
    const loc = r.headers.get("location") ?? "";
    loc.includes("/admin") ? ok("TC-2.2.8: /dashboard -> /admin for ADMIN") : fail("TC-2.2.8: /dashboard -> /admin for ADMIN", loc);
  }
}

// ─── FR-2.3: Password Reset ────────────────────────────────

async function testFR23() {
  console.log("\n═══ FR-2.3: Password Reset ═══");

  const user = await prisma.user.findUnique({ where: { email: EMPLOYEE2.email } });
  if (!user) { skip("FR-2.3", "employee2 not found"); return; }
  const origHash = user.passwordHash;

  {
    const r = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMPLOYEE2.email }),
    });
    const d = (await r.json()) as { message: string };
    r.status === 200 && d.message?.includes("If an account")
      ? ok("TC-2.3.1: Forgot password generic response") : fail("TC-2.3.1: Forgot password generic response");
  }
  {
    const r = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doesnotexist@test.com" }),
    });
    const d = (await r.json()) as { message: string };
    r.status === 200 && d.message?.includes("If an account")
      ? ok("TC-2.3.2: No email enumeration") : fail("TC-2.3.2: No email enumeration");
  }
  {
    const raw = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(raw).digest("hex");
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 3600000) } });
    const r = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: raw, newPassword: "NewPass123!" }),
    });
    r.status === 200 ? ok("TC-2.3.3: Reset with valid token") : fail("TC-2.3.3: Reset with valid token", `${r.status}`);
  }
  {
    const r = await login(EMPLOYEE2.email, "NewPass123!");
    r.authenticated ? ok("TC-2.3.4: Login with new password") : fail("TC-2.3.4: Login with new password");
  }
  {
    const r = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid", newPassword: "X12345678!" }),
    });
    r.status === 400 ? ok("TC-2.3.5: Invalid token rejected") : fail("TC-2.3.5: Invalid token rejected", `${r.status}`);
  }
  {
    const raw = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(raw).digest("hex");
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() - 60000) } });
    const r = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: raw, newPassword: "X12345678!" }),
    });
    r.status === 400 ? ok("TC-2.3.6: Expired token rejected") : fail("TC-2.3.6: Expired token rejected", `${r.status}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: origHash } });
}

// ─── FR-2.4: Session Duration ──────────────────────────────

async function testFR24() {
  console.log("\n═══ FR-2.4: Session Duration ═══");

  {
    const maxAge = parseInt(process.env.SESSION_MAX_AGE ?? "86400", 10);
    maxAge > 0 ? ok(`TC-2.4.1: Session maxAge=${maxAge}s`) : fail("TC-2.4.1: Session maxAge configured");
  }
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const s = await getSession(cookies);
    const u = s?.user as Record<string, unknown> | undefined;
    u?.id && u?.role && u?.email ? ok("TC-2.4.2: Session has id, role, email") : fail("TC-2.4.2: Session has id, role, email");
  }
}

// ─── FR-2.5: Audit Logging ─────────────────────────────────

async function testFR25() {
  console.log("\n═══ FR-2.5: Audit Logging ═══");

  const adminUser = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  if (!adminUser) { skip("FR-2.5", "admin not found"); return; }

  {
    const before = new Date();
    await login(ADMIN.email, ADMIN.password);
    await new Promise(r => setTimeout(r, 500));
    const log = await prisma.auditLog.findFirst({ where: { userId: adminUser.id, action: "LOGIN_SUCCESS", createdAt: { gte: before } }, orderBy: { createdAt: "desc" } });
    log ? ok("TC-2.5.1: LOGIN_SUCCESS audit log") : fail("TC-2.5.1: LOGIN_SUCCESS audit log");
  }
  {
    const before = new Date();
    await login(ADMIN.email, "WrongPassword999!");
    await new Promise(r => setTimeout(r, 500));
    const log = await prisma.auditLog.findFirst({ where: { action: "LOGIN_FAILURE", createdAt: { gte: before }, metadata: { path: ["email"], equals: ADMIN.email } }, orderBy: { createdAt: "desc" } });
    log ? ok("TC-2.5.2: LOGIN_FAILURE audit log") : fail("TC-2.5.2: LOGIN_FAILURE audit log");
  }
  {
    const before = new Date();
    await fetch(`${BASE}/api/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ADMIN.email }) });
    await new Promise(r => setTimeout(r, 500));
    const log = await prisma.auditLog.findFirst({ where: { userId: adminUser.id, action: "PASSWORD_RESET_REQUESTED", createdAt: { gte: before } } });
    log ? ok("TC-2.5.3: PASSWORD_RESET_REQUESTED audit log") : fail("TC-2.5.3: PASSWORD_RESET_REQUESTED audit log");
  }
  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const emp = await prisma.user.findUnique({ where: { email: EMPLOYEE1.email } });
    const before = new Date();
    await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: EMPLOYEE1.password, newPassword: "Changed123!" }),
    });
    await new Promise(r => setTimeout(r, 500));
    const log = await prisma.auditLog.findFirst({ where: { userId: emp!.id, action: "PASSWORD_CHANGED", createdAt: { gte: before } } });
    log ? ok("TC-2.5.4: PASSWORD_CHANGED audit log") : fail("TC-2.5.4: PASSWORD_CHANGED audit log");
    await prisma.user.update({ where: { id: emp!.id }, data: { passwordHash: await bcrypt.hash(EMPLOYEE1.password, 12) } });
  }
}

// ─── FR-2.6: Change Password ───────────────────────────────

async function testFR26() {
  console.log("\n═══ FR-2.6: Change Password ═══");

  const user = await prisma.user.findUnique({ where: { email: EMPLOYEE2.email } });
  if (!user) { skip("FR-2.6", "employee2 not found"); return; }
  const origHash = user.passwordHash;

  {
    const r = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: EMPLOYEE2.password, newPassword: "NewPass456!" }),
    });
    r.status === 401 ? ok("TC-2.6.1: Unauthenticated change rejected (401)") : fail("TC-2.6.1: Unauthenticated change rejected (401)", `${r.status}`);
  }
  {
    const { cookies } = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    const r = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: "WrongCurrent!", newPassword: "NewPass456!" }),
    });
    r.status === 401 ? ok("TC-2.6.2: Wrong current password rejected") : fail("TC-2.6.2: Wrong current password rejected", `${r.status}`);
  }
  {
    const { cookies } = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    const r = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: EMPLOYEE2.password, newPassword: "short" }),
    });
    r.status === 400 ? ok("TC-2.6.3: Short password rejected (400)") : fail("TC-2.6.3: Short password rejected (400)", `${r.status}`);
  }
  {
    const { cookies } = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    const r = await fetch(`${BASE}/api/auth/change-password`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ currentPassword: EMPLOYEE2.password, newPassword: "Changed456!" }),
    });
    r.status === 200 ? ok("TC-2.6.4: Password changed successfully") : fail("TC-2.6.4: Password changed successfully", `${r.status}`);
  }
  {
    const r = await login(EMPLOYEE2.email, "Changed456!");
    r.authenticated ? ok("TC-2.6.5: Login with new password") : fail("TC-2.6.5: Login with new password");
  }
  {
    const r = await login(EMPLOYEE2.email, EMPLOYEE2.password);
    !r.authenticated ? ok("TC-2.6.6: Old password no longer works") : fail("TC-2.6.6: Old password no longer works");
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: origHash } });
}

// ─── FR-1.1: Create User ───────────────────────────────────

async function testFR11() {
  console.log("\n═══ FR-1.1: Create User ═══");

  const { cookies } = await login(ADMIN.email, ADMIN.password);

  {
    const r = await fetch(`${BASE}/api/users`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Test User", email: "testcreate@almnfthen.com", password: "TestPass123!", role: "EMPLOYEE", status: "ACTIVE" }),
    });
    const d = await r.json();
    r.status === 201 && d.id ? ok("TC-1.1.1: Admin creates user (201)") : fail("TC-1.1.1: Admin creates user (201)", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/users`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Dup", email: "testcreate@almnfthen.com", password: "TestPass123!", role: "EMPLOYEE" }),
    });
    r.status === 409 ? ok("TC-1.1.2: Duplicate email rejected (409)") : fail("TC-1.1.2: Duplicate email rejected (409)", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/users`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "", email: "bad@test.com", password: "short", role: "EMPLOYEE" }),
    });
    r.status === 400 ? ok("TC-1.1.3: Validation errors rejected (400)") : fail("TC-1.1.3: Validation errors rejected (400)", `${r.status}`);
  }
  {
    const r = await login("testcreate@almnfthen.com", "TestPass123!");
    r.authenticated ? ok("TC-1.1.4: Newly created user can login") : fail("TC-1.1.4: Newly created user can login");
  }
}

// ─── FR-1.2: Deactivate User ───────────────────────────────

async function testFR12() {
  console.log("\n═══ FR-1.2: Deactivate User ═══");

  const { cookies } = await login(ADMIN.email, ADMIN.password);
  const user = await prisma.user.findUnique({ where: { email: "testcreate@almnfthen.com" } });
  if (!user) { skip("FR-1.2", "test user not found"); return; }

  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ status: "INACTIVE" }),
    });
    const d = await r.json();
    r.status === 200 && d.status === "INACTIVE"
      ? ok("TC-1.2.1: Admin deactivates user") : fail("TC-1.2.1: Admin deactivates user", `${r.status} ${d.status}`);
  }
  {
    const r = await login("testcreate@almnfthen.com", "TestPass123!");
    !r.authenticated ? ok("TC-1.2.2: Deactivated user cannot login") : fail("TC-1.2.2: Deactivated user cannot login");
  }
  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const d = await r.json();
    r.status === 200 && d.status === "ACTIVE"
      ? ok("TC-1.2.3: Admin reactivates user") : fail("TC-1.2.3: Admin reactivates user");
  }
}

// ─── FR-1.3: Manager Assignment ────────────────────────────

async function testFR13() {
  console.log("\n═══ FR-1.3: Manager Assignment ═══");

  const { cookies } = await login(ADMIN.email, ADMIN.password);
  const mgr = await prisma.user.findUnique({ where: { email: MANAGER.email } });
  const user = await prisma.user.findUnique({ where: { email: "testcreate@almnfthen.com" } });
  if (!mgr || !user) { skip("FR-1.3", "users not found"); return; }

  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ managerId: mgr.id }),
    });
    r.status === 200 ? ok("TC-1.3.1: Assign manager to employee") : fail("TC-1.3.1: Assign manager to employee", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, { headers: { Cookie: cookies } });
    const d = await r.json();
    d.managerId === mgr.id ? ok("TC-1.3.2: Manager assignment persisted") : fail("TC-1.3.2: Manager assignment persisted", d.managerId);
  }
  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ managerId: null }),
    });
    const d = await r.json();
    r.status === 200 && d.managerId === null
      ? ok("TC-1.3.3: Remove manager assignment") : fail("TC-1.3.3: Remove manager assignment");
  }
}

// ─── FR-1.4: View & Edit User ──────────────────────────────

async function testFR14() {
  console.log("\n═══ FR-1.4: View & Edit User ═══");

  const { cookies } = await login(ADMIN.email, ADMIN.password);

  {
    const r = await fetch(`${BASE}/api/users`, { headers: { Cookie: cookies } });
    const d = await r.json();
    r.status === 200 && Array.isArray(d.users) && d.users.length > 0
      ? ok("TC-1.4.1: GET /api/users returns user list") : fail("TC-1.4.1: GET /api/users returns user list", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/users?search=admin`, { headers: { Cookie: cookies } });
    const d = await r.json();
    d.users?.length === 1 && d.users[0].email === ADMIN.email
      ? ok("TC-1.4.2: Search filter works") : fail("TC-1.4.2: Search filter works", `Found ${d.users?.length}`);
  }
  {
    const r = await fetch(`${BASE}/api/users?role=MANAGER`, { headers: { Cookie: cookies } });
    const d = await r.json();
    d.users?.every((u: { role: string }) => u.role === "MANAGER")
      ? ok("TC-1.4.3: Role filter works") : fail("TC-1.4.3: Role filter works");
  }
  {
    const r = await fetch(`${BASE}/api/users?status=ACTIVE`, { headers: { Cookie: cookies } });
    const d = await r.json();
    d.users?.every((u: { status: string }) => u.status === "ACTIVE")
      ? ok("TC-1.4.4: Status filter works") : fail("TC-1.4.4: Status filter works");
  }
  {
    const r = await fetch(`${BASE}/api/users?page=1&limit=2`, { headers: { Cookie: cookies } });
    const d = await r.json();
    d.users?.length <= 2 && d.pagination?.totalPages >= 1
      ? ok("TC-1.4.5: Pagination works") : fail("TC-1.4.5: Pagination works");
  }
  {
    const user = await prisma.user.findUnique({ where: { email: "testcreate@almnfthen.com" } });
    if (!user) { fail("TC-1.4.6: Edit user — test user missing"); return; }
    const r = await fetch(`${BASE}/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed User" }),
    });
    const d = await r.json();
    r.status === 200 && d.name === "Renamed User"
      ? ok("TC-1.4.6: Edit user name") : fail("TC-1.4.6: Edit user name", `${r.status} ${d.name}`);
  }
  {
    const r = await fetch(`${BASE}/api/users/nonexistent-id`, { headers: { Cookie: cookies } });
    r.status === 404 ? ok("TC-1.4.7: GET non-existent user (404)") : fail("TC-1.4.7: GET non-existent user (404)", `${r.status}`);
  }
}

// ─── FR-1.7: Unique Email (API level) ──────────────────────

async function testFR17() {
  console.log("\n═══ FR-1.7: Unique Email Validation ═══");

  const { cookies } = await login(ADMIN.email, ADMIN.password);

  {
    const r = await fetch(`${BASE}/api/users`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Dup", email: ADMIN.email, password: "TestPass123!", role: "EMPLOYEE" }),
    });
    const d = await r.json();
    r.status === 409 && d.error?.includes("already")
      ? ok("TC-1.7.1: Duplicate email on create rejected") : fail("TC-1.7.1: Duplicate email on create rejected", `${r.status}`);
  }
}

// ─── FR-1: Delete User ─────────────────────────────────────

async function testDelete() {
  console.log("\n═══ FR-1: Delete User ═══");

  const { cookies } = await login(ADMIN.email, ADMIN.password);
  const user = await prisma.user.findUnique({ where: { email: "testcreate@almnfthen.com" } });
  if (!user) { skip("Delete", "test user not found"); return; }

  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, { method: "DELETE", headers: { Cookie: cookies } });
    r.status === 204 ? ok("TC-1.D.1: Delete user (204)") : fail("TC-1.D.1: Delete user (204)", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, { headers: { Cookie: cookies } });
    r.status === 404 ? ok("TC-1.D.2: Deleted user not found (404)") : fail("TC-1.D.2: Deleted user not found (404)", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/users/${user.id}`, { method: "DELETE", headers: { Cookie: cookies } });
    r.status === 404 ? ok("TC-1.D.3: Re-delete returns 404") : fail("TC-1.D.3: Re-delete returns 404", `${r.status}`);
  }
}

// ─── Non-admin API protection ──────────────────────────────

async function testNonAdminBlock() {
  console.log("\n═══ API Protection: Non-Admin Blocked ═══");

  {
    const { cookies } = await login(EMPLOYEE1.email, EMPLOYEE1.password);
    const r = await fetch(`${BASE}/api/users`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Hack", email: "hack@test.com", password: "TestPass123!", role: "ADMIN" }),
    });
    r.status === 403 ? ok("TC-P.1: Employee cannot POST /api/users (403)") : fail("TC-P.1: Employee cannot POST /api/users (403)", `${r.status}`);
  }
  {
    const { cookies } = await login(MANAGER.email, MANAGER.password);
    const r = await fetch(`${BASE}/api/users`, { headers: { Cookie: cookies } });
    r.status === 403 ? ok("TC-P.2: Manager cannot GET /api/users (403)") : fail("TC-P.2: Manager cannot GET /api/users (403)", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/admin/stats`);
    r.status === 401 ? ok("TC-P.3: Unauthenticated /api/admin/stats (401)") : fail("TC-P.3: Unauthenticated /api/admin/stats (401)", `${r.status}`);
  }
  {
    const { cookies } = await login(ADMIN.email, ADMIN.password);
    const r = await fetch(`${BASE}/api/admin/stats`, { headers: { Cookie: cookies } });
    r.status === 200 ? ok("TC-P.4: Admin can GET /api/admin/stats") : fail("TC-P.4: Admin can GET /api/admin/stats", `${r.status}`);
  }
}

// ─── Cleanup & Run ─────────────────────────────────────────

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: "testcreate@almnfthen.com" } });
  const emp2 = await prisma.user.findUnique({ where: { email: EMPLOYEE2.email } });
  if (emp2) await prisma.passwordResetToken.deleteMany({ where: { userId: emp2.id } });
  const admin = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  if (admin) await prisma.passwordResetToken.deleteMany({ where: { userId: admin.id } });
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   TMS Full Integration Test Suite                           ║");
  console.log("║   FR-1.x (User Management) + FR-2.x (Authentication)       ║");
  console.log("║   Testing against: http://localhost:3000                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  try {
    const r = await fetch(`${BASE}/api/auth/csrf`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
  } catch {
    console.error("\n❌ Cannot reach dev server at http://localhost:3000\n");
    process.exit(1);
  }

  try {
    await testFR21();
    await testFR22();
    await testFR23();
    await testFR24();
    await testFR25();
    await testFR26();
    await testFR11();
    await testFR12();
    await testFR13();
    await testFR14();
    await testFR17();
    await testDelete();
    await testNonAdminBlock();
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
