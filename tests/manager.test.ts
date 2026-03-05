/**
 * Manager Module Integration Tests
 * Covers: Manager stats, team members, enrollment approval/rejection,
 *         training assignment, team reports, notifications
 *
 * Usage: npx tsx tests/manager.test.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function ok(name: string) {
  passed++;
  console.log(`  ✅ PASS  ${name}`);
}
function fail(name: string, detail?: string) {
  failed++;
  console.log(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

// ─── Auth Helpers ──────────────────────────────────────────

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
        if (
          ![
            "path",
            "expires",
            "max-age",
            "domain",
            "samesite",
            "httponly",
            "secure",
          ].includes(k.toLowerCase())
        ) {
          map.set(k, v);
        }
      }
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookies = extractSetCookies(csrfRes.headers);

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: mergeCookies(...csrfCookies),
    },
    body: new URLSearchParams({ email, password, csrfToken }),
    redirect: "manual",
  });

  return mergeCookies(...csrfCookies, ...extractSetCookies(res.headers));
}

// ─── Test Data Setup ──────────────────────────────────────

const MANAGER_EMAIL = "test-manager@almnfthen.com";
const MANAGER_PASS = "Manager123!";
const EMP_A_EMAIL = "test-emp-a@almnfthen.com";
const EMP_B_EMAIL = "test-emp-b@almnfthen.com";
const EMP_PASS = "Employee123!";
const ADMIN = { email: "admin@almnfthen.com", password: "Admin123!" };

let managerCookies = "";
let empACookies = "";
let adminCookies = "";
let managerId = "";
let empAId = "";
let empBId = "";
let testCourseId = "";
let testEnrollmentId = "";

async function setup() {
  console.log("\n🔧  Setting up test data...");

  const hash = await bcrypt.hash(MANAGER_PASS, 12);
  const empHash = await bcrypt.hash(EMP_PASS, 12);

  const manager = await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: { passwordHash: hash, role: "MANAGER", status: "ACTIVE" },
    create: {
      name: "Test Manager",
      email: MANAGER_EMAIL,
      passwordHash: hash,
      role: "MANAGER",
      status: "ACTIVE",
    },
  });
  managerId = manager.id;

  const empA = await prisma.user.upsert({
    where: { email: EMP_A_EMAIL },
    update: {
      passwordHash: empHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      managerId: manager.id,
    },
    create: {
      name: "Employee Alpha",
      email: EMP_A_EMAIL,
      passwordHash: empHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      managerId: manager.id,
    },
  });
  empAId = empA.id;

  const empB = await prisma.user.upsert({
    where: { email: EMP_B_EMAIL },
    update: {
      passwordHash: empHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      managerId: manager.id,
    },
    create: {
      name: "Employee Beta",
      email: EMP_B_EMAIL,
      passwordHash: empHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      managerId: manager.id,
    },
  });
  empBId = empB.id;

  const course = await prisma.course.create({
    data: {
      title: "Manager Test Course",
      description: "A test course for manager module tests",
      status: "PUBLISHED",
      category: "Testing",
      createdById: manager.id,
    },
  });
  testCourseId = course.id;

  console.log(
    `    Manager: ${managerId}\n    EmpA: ${empAId}\n    EmpB: ${empBId}\n    Course: ${testCourseId}`
  );
}

async function cleanup() {
  console.log("\n🧹  Cleaning up...");
  await prisma.notification.deleteMany({
    where: { userId: { in: [managerId, empAId, empBId] } },
  });
  await prisma.enrollment.deleteMany({
    where: { userId: { in: [empAId, empBId] } },
  });
  await prisma.course.deleteMany({ where: { id: testCourseId } });
  await prisma.user.deleteMany({
    where: { email: { in: [EMP_A_EMAIL, EMP_B_EMAIL] } },
  });
  await prisma.user.deleteMany({ where: { email: MANAGER_EMAIL } });
  await prisma.$disconnect();
}

// ─── Tests ────────────────────────────────────────────────

async function runTests() {
  console.log("\n🚀  Manager Module Integration Tests\n");

  // Ensure server is up
  try {
    const health = await fetch(`${BASE}/api/auth/csrf`);
    if (!health.ok) throw new Error(`Status ${health.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ Cannot reach dev server at ${BASE} — ${msg}`);
    process.exit(1);
  }

  // ─── Login ──────────────────────────────────────────────
  console.log("\n📋  Login...");

  try {
    managerCookies = await login(MANAGER_EMAIL, MANAGER_PASS);
    managerCookies ? ok("Manager login") : fail("Manager login", "No cookies");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Manager login", msg);
  }

  try {
    empACookies = await login(EMP_A_EMAIL, EMP_PASS);
    empACookies ? ok("Employee A login") : fail("Employee A login", "No cookies");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Employee A login", msg);
  }

  try {
    adminCookies = await login(ADMIN.email, ADMIN.password);
    adminCookies ? ok("Admin login") : fail("Admin login", "No cookies");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Admin login", msg);
  }

  // ─── Manager Stats ─────────────────────────────────────
  console.log("\n📋  Manager Stats...");

  try {
    const res = await fetch(`${BASE}/api/manager/stats`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    res.status === 200 && typeof data.teamSize === "number"
      ? ok("GET /api/manager/stats returns stats")
      : fail("GET /api/manager/stats", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("GET /api/manager/stats", msg);
  }

  try {
    const res = await fetch(`${BASE}/api/manager/stats`, {
      headers: { Cookie: empACookies },
    });
    res.status === 403
      ? ok("Employee blocked from manager stats (403)")
      : fail("Employee blocked from manager stats", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Employee blocked from manager stats", msg);
  }

  // ─── Manager Team ──────────────────────────────────────
  console.log("\n📋  Manager Team...");

  try {
    const res = await fetch(`${BASE}/api/manager/team`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    res.status === 200 && Array.isArray(data.members) && data.members.length >= 2
      ? ok("GET /api/manager/team returns team members")
      : fail(
          "GET /api/manager/team",
          `Status ${res.status}, members: ${data.members?.length}`
        );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("GET /api/manager/team", msg);
  }

  try {
    const res = await fetch(
      `${BASE}/api/manager/team?search=Alpha`,
      { headers: { Cookie: managerCookies } }
    );
    const data = await res.json();
    data.members?.length === 1 && data.members[0].name === "Employee Alpha"
      ? ok("GET /api/manager/team search filters correctly")
      : fail("GET /api/manager/team search", `Found ${data.members?.length}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("GET /api/manager/team search", msg);
  }

  // ─── Employee Self-Enrollment (creates PENDING + notification) ──
  console.log("\n📋  Employee Enrollment Request...");

  try {
    const res = await fetch(`${BASE}/api/enrollments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: empACookies,
      },
      body: JSON.stringify({ userId: empAId, courseId: testCourseId }),
    });
    const data = await res.json();
    if (res.status === 201 && data.status === "PENDING") {
      testEnrollmentId = data.id;
      ok("Employee self-enrollment creates PENDING enrollment");
    } else {
      fail(
        "Employee self-enrollment",
        `Status ${res.status}, enrollment status: ${data.status}`
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Employee self-enrollment", msg);
  }

  // Verify notification was sent to manager
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: managerId, type: "APPROVAL" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    notifs.length > 0 && notifs[0].title === "New Enrollment Request"
      ? ok("Manager received enrollment request notification")
      : fail("Manager notification", `Found ${notifs.length}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Manager notification", msg);
  }

  // ─── Manager sees pending enrollment ───────────────────
  console.log("\n📋  Manager Enrollment Visibility...");

  try {
    const res = await fetch(`${BASE}/api/enrollments?status=PENDING`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    const found = data.enrollments?.some(
      (e: { id: string }) => e.id === testEnrollmentId
    );
    found
      ? ok("Manager sees team member's pending enrollment")
      : fail("Manager sees pending enrollment", "Not found in list");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Manager sees pending enrollment", msg);
  }

  // ─── Approve Enrollment ────────────────────────────────
  console.log("\n📋  Approve/Reject Enrollment...");

  try {
    const res = await fetch(`${BASE}/api/enrollments/${testEnrollmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: managerCookies,
      },
      body: JSON.stringify({
        status: "APPROVED",
        comment: "Looks good, approved!",
      }),
    });
    const data = await res.json();
    res.status === 200 && data.status === "APPROVED" && data.comment === "Looks good, approved!"
      ? ok("Manager approves enrollment with comment")
      : fail("Approve enrollment", `Status ${res.status}, data: ${JSON.stringify(data)}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Approve enrollment", msg);
  }

  // Verify employee got notification
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: empAId, type: "APPROVAL" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    notifs.length > 0 && notifs[0].title === "Enrollment approved"
      ? ok("Employee received approval notification")
      : fail("Employee approval notification", `Found ${notifs.length}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Employee approval notification", msg);
  }

  // Cannot approve already-approved enrollment
  try {
    const res = await fetch(`${BASE}/api/enrollments/${testEnrollmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: managerCookies,
      },
      body: JSON.stringify({ status: "REJECTED" }),
    });
    res.status === 400
      ? ok("Cannot approve/reject non-PENDING enrollment (400)")
      : fail("Non-PENDING rejection", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Non-PENDING rejection", msg);
  }

  // ─── Reject test (create another enrollment first) ─────
  let rejectEnrollmentId = "";
  try {
    await prisma.enrollment.deleteMany({
      where: { userId: empBId, courseId: testCourseId },
    });
    const enroll = await prisma.enrollment.create({
      data: { userId: empBId, courseId: testCourseId, status: "PENDING" },
    });
    rejectEnrollmentId = enroll.id;

    const res = await fetch(`${BASE}/api/enrollments/${rejectEnrollmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: managerCookies,
      },
      body: JSON.stringify({
        status: "REJECTED",
        comment: "Try the advanced course instead",
      }),
    });
    const data = await res.json();
    res.status === 200 && data.status === "REJECTED"
      ? ok("Manager rejects enrollment with comment")
      : fail("Reject enrollment", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Reject enrollment", msg);
  }

  // ─── Admin cannot approve outside-team enrollment via manager scope ──
  // (Admin can approve any, but a different manager cannot)
  // We test that employee access is blocked
  try {
    const res = await fetch(`${BASE}/api/enrollments/${testEnrollmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: empACookies,
      },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    res.status === 403
      ? ok("Employee cannot approve enrollments (403)")
      : fail("Employee approve blocked", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Employee approve blocked", msg);
  }

  // ─── GET single enrollment (before assign cleanup deletes it) ──
  console.log("\n📋  Single Enrollment...");

  try {
    const res = await fetch(`${BASE}/api/enrollments/${testEnrollmentId}`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    res.status === 200 && data.id === testEnrollmentId
      ? ok("GET /api/enrollments/:id returns enrollment")
      : fail("GET single enrollment", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("GET single enrollment", msg);
  }

  try {
    const res = await fetch(`${BASE}/api/enrollments/nonexistent`, {
      headers: { Cookie: managerCookies },
    });
    res.status === 404
      ? ok("GET /api/enrollments/:id 404 for nonexistent")
      : fail("GET nonexistent enrollment", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("GET nonexistent enrollment", msg);
  }

  // ─── Assign Training ──────────────────────────────────
  console.log("\n📋  Assign Training...");

  // Clean up enrollments for empB first
  await prisma.enrollment.deleteMany({
    where: { userId: empBId, courseId: testCourseId },
  });

  try {
    const res = await fetch(`${BASE}/api/manager/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: managerCookies,
      },
      body: JSON.stringify({
        userIds: [empBId],
        courseId: testCourseId,
        deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      }),
    });
    const data = await res.json();
    res.status === 200 && data.assigned === 1 && data.skipped === 0
      ? ok("Manager assigns course to team member")
      : fail("Assign training", `Status ${res.status}, data: ${JSON.stringify(data)}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Assign training", msg);
  }

  // Duplicate assignment should skip
  try {
    const res = await fetch(`${BASE}/api/manager/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: managerCookies,
      },
      body: JSON.stringify({ userIds: [empBId], courseId: testCourseId }),
    });
    const data = await res.json();
    data.assigned === 0 && data.skipped === 1
      ? ok("Duplicate assignment is skipped")
      : fail("Duplicate assignment", `assigned=${data.assigned} skipped=${data.skipped}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Duplicate assignment", msg);
  }

  // Bulk assign to multiple
  await prisma.enrollment.deleteMany({
    where: { courseId: testCourseId, userId: { in: [empAId, empBId] } },
  });
  try {
    const res = await fetch(`${BASE}/api/manager/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: managerCookies,
      },
      body: JSON.stringify({ userIds: [empAId, empBId], courseId: testCourseId }),
    });
    const data = await res.json();
    data.assigned === 2
      ? ok("Bulk assign to entire team")
      : fail("Bulk assign", `assigned=${data.assigned}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Bulk assign", msg);
  }

  // Employee receives assignment notification
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: empBId, title: "New Training Assigned" },
    });
    notifs.length > 0
      ? ok("Employee received training assignment notification")
      : fail("Assignment notification", "Not found");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Assignment notification", msg);
  }

  // Employee cannot use manager assign endpoint
  try {
    const res = await fetch(`${BASE}/api/manager/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: empACookies,
      },
      body: JSON.stringify({ userIds: [empBId], courseId: testCourseId }),
    });
    res.status === 403
      ? ok("Employee blocked from assign endpoint (403)")
      : fail("Employee assign blocked", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Employee assign blocked", msg);
  }

  // ─── Manager Reports ──────────────────────────────────
  console.log("\n📋  Manager Reports...");

  try {
    const res = await fetch(`${BASE}/api/manager/reports`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    res.status === 200 &&
    data.teamOverview &&
    Array.isArray(data.memberBreakdown)
      ? ok("GET /api/manager/reports returns report data")
      : fail("Manager reports", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Manager reports", msg);
  }

  try {
    const res = await fetch(
      `${BASE}/api/manager/reports?from=2020-01-01&to=2030-12-31`,
      { headers: { Cookie: managerCookies } }
    );
    const data = await res.json();
    data.teamOverview.totalEnrollments >= 0
      ? ok("Manager reports with date range filter")
      : fail("Manager reports date filter", JSON.stringify(data));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Manager reports date filter", msg);
  }

  // ─── Notifications API ─────────────────────────────────
  console.log("\n📋  Notifications...");

  try {
    const res = await fetch(`${BASE}/api/notifications/count`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    res.status === 200 && typeof data.unread === "number"
      ? ok("GET /api/notifications/count returns unread count")
      : fail("Notification count", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Notification count", msg);
  }

  try {
    const res = await fetch(`${BASE}/api/notifications`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    res.status === 200 && Array.isArray(data.notifications)
      ? ok("GET /api/notifications returns notification list")
      : fail("Notification list", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Notification list", msg);
  }

  try {
    const res = await fetch(`${BASE}/api/notifications?unreadOnly=true`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    res.status === 200 && Array.isArray(data.notifications)
      ? ok("GET /api/notifications with unreadOnly filter")
      : fail("Notification unread filter", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Notification unread filter", msg);
  }

  // Mark all as read
  try {
    const res = await fetch(`${BASE}/api/notifications`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: managerCookies,
      },
      body: JSON.stringify({ markAllRead: true }),
    });
    const data = await res.json();
    res.status === 200 && data.success
      ? ok("PATCH /api/notifications markAllRead")
      : fail("Mark all read", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Mark all read", msg);
  }

  // Verify count is 0
  try {
    const res = await fetch(`${BASE}/api/notifications/count`, {
      headers: { Cookie: managerCookies },
    });
    const data = await res.json();
    data.unread === 0
      ? ok("Unread count is 0 after marking all read")
      : fail("Unread count after mark", `unread=${data.unread}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Unread count after mark", msg);
  }

  // Unauthenticated access blocked
  try {
    const res = await fetch(`${BASE}/api/notifications`);
    res.status === 401
      ? ok("Unauthenticated blocked from notifications (401)")
      : fail("Unauth notifications", `Status ${res.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail("Unauth notifications", msg);
  }

}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  try {
    await setup();
    await runTests();
  } catch (e) {
    console.error("Unexpected error:", e);
  } finally {
    await cleanup();
  }
  console.log(`\n${"═".repeat(50)}`);
  console.log(
    `  Results:  ✅ ${passed} passed   ❌ ${failed} failed`
  );
  console.log(`${"═".repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
