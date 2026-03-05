/**
 * Admin Module Integration Tests
 * Covers: Course CRUD, Modules, Quizzes, Questions, Duplication,
 *         Prerequisites, Bulk User Import, Bulk Status, Reports, Admin Stats
 *
 * Usage: npx tsx tests/admin.test.ts
 */

import { PrismaClient } from "@prisma/client";

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
        if (!["path", "expires", "max-age", "domain", "samesite", "httponly", "secure"].includes(k.toLowerCase())) {
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
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: mergeCookies(...csrfCookies) },
    body: new URLSearchParams({ email, password, csrfToken }),
    redirect: "manual",
  });

  return mergeCookies(...csrfCookies, ...extractSetCookies(res.headers));
}

const ADMIN = { email: "admin@almnfthen.com", password: "Admin123!" };
const EMPLOYEE = { email: "employee1@almnfthen.com", password: "Employee123!" };

let adminCookies = "";
let employeeCookies = "";

// ─── Tracked IDs for cleanup ───────────────────────────────

let testCourseId = "";
let testModuleId = "";
let testQuizId = "";
let testQuestionId = "";
let duplicatedCourseId = "";
const bulkUserEmails: string[] = [];

// ─── Course CRUD ───────────────────────────────────────────

async function testCourseCRUD() {
  console.log("\n═══ Course CRUD (FR-3.1, FR-3.5, FR-3.7) ═══");

  {
    const r = await fetch(`${BASE}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ title: "Test Course", description: "Desc", category: "Technical", status: "DRAFT" }),
    });
    const d = await r.json();
    r.status === 201 && d.id && d.createdBy?.id
      ? ok("TC-C.1: Create course (201) with creator tracked") : fail("TC-C.1: Create course", `${r.status}`);
    testCourseId = d.id;
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    r.status === 200 && d.title === "Test Course" && d.status === "DRAFT"
      ? ok("TC-C.2: Get course by ID") : fail("TC-C.2: Get course by ID");
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ status: "PUBLISHED", title: "Test Course Updated" }),
    });
    const d = await r.json();
    r.status === 200 && d.status === "PUBLISHED" && d.title === "Test Course Updated"
      ? ok("TC-C.3: Update course status & title") : fail("TC-C.3: Update course", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses?search=Test+Course`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    d.courses?.length >= 1 ? ok("TC-C.4: Search courses") : fail("TC-C.4: Search courses", `${d.courses?.length}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses?status=PUBLISHED`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    d.courses?.every((c: { status: string }) => c.status === "PUBLISHED")
      ? ok("TC-C.5: Filter by status") : fail("TC-C.5: Filter by status");
  }
  {
    const r = await fetch(`${BASE}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ title: "" }),
    });
    r.status === 400 ? ok("TC-C.6: Validation rejects empty title") : fail("TC-C.6: Validation", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: employeeCookies },
      body: JSON.stringify({ title: "Hack" }),
    });
    r.status === 403 ? ok("TC-C.7: Employee blocked from course create (403)") : fail("TC-C.7: Employee blocked", `${r.status}`);
  }
}

// ─── Module CRUD ───────────────────────────────────────────

async function testModuleCRUD() {
  console.log("\n═══ Module CRUD (FR-3.2, FR-3.3) ═══");

  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ title: "Module 1", type: "VIDEO", contentUrl: "https://youtube.com/watch?v=test1" }),
    });
    const d = await r.json();
    r.status === 201 && d.id
      ? ok("TC-M.1: Create module (201)") : fail("TC-M.1: Create module", `${r.status}`);
    testModuleId = d.id;
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ title: "Module 2", type: "PDF", contentUrl: "https://example.com/doc.pdf" }),
    });
    r.status === 201 ? ok("TC-M.2: Create second module") : fail("TC-M.2: Create second module", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/modules`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    Array.isArray(d) && d.length === 2
      ? ok("TC-M.3: List modules (2 found)") : fail("TC-M.3: List modules", `${d.length}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/modules/${testModuleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ title: "Module 1 Updated", sequence: 5 }),
    });
    const d = await r.json();
    r.status === 200 && d.title === "Module 1 Updated" && d.sequence === 5
      ? ok("TC-M.4: Update module title & sequence") : fail("TC-M.4: Update module", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ title: "", type: "VIDEO", contentUrl: "" }),
    });
    r.status === 400 ? ok("TC-M.5: Validation rejects empty module") : fail("TC-M.5: Validation", `${r.status}`);
  }
}

// ─── Quiz CRUD ─────────────────────────────────────────────

async function testQuizCRUD() {
  console.log("\n═══ Quiz CRUD (FR-4.3, FR-4.6) ═══");

  {
    const r = await fetch(`${BASE}/api/modules/${testModuleId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ passingScore: 70, durationMinutes: 30, maxAttempts: 3 }),
    });
    const d = await r.json();
    r.status === 201 && d.id
      ? ok("TC-Q.1: Create quiz (201)") : fail("TC-Q.1: Create quiz", `${r.status}`);
    testQuizId = d.id;
  }
  {
    const r = await fetch(`${BASE}/api/modules/${testModuleId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ passingScore: 80, durationMinutes: 20, maxAttempts: 2 }),
    });
    r.status === 409 ? ok("TC-Q.2: Duplicate quiz rejected (409)") : fail("TC-Q.2: Duplicate quiz", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/modules/${testModuleId}/quiz`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ passingScore: 80, maxAttempts: 5 }),
    });
    const d = await r.json();
    r.status === 200 && d.passingScore === 80 && d.maxAttempts === 5
      ? ok("TC-Q.3: Update quiz passing score & attempts") : fail("TC-Q.3: Update quiz", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/modules/${testModuleId}/quiz`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    r.status === 200 && d.id === testQuizId
      ? ok("TC-Q.4: Get quiz by module") : fail("TC-Q.4: Get quiz", `${r.status}`);
  }
}

// ─── Question CRUD ─────────────────────────────────────────

async function testQuestionCRUD() {
  console.log("\n═══ Question CRUD (FR-4.1, FR-4.2) ═══");

  {
    const r = await fetch(`${BASE}/api/quizzes/${testQuizId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({
        questionText: "What is 2+2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: "4",
      }),
    });
    const d = await r.json();
    r.status === 201 && d.id
      ? ok("TC-QN.1: Create question (201)") : fail("TC-QN.1: Create question", `${r.status}`);
    testQuestionId = d.id;
  }
  {
    const r = await fetch(`${BASE}/api/quizzes/${testQuizId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({
        questionText: "Capital of France?",
        options: ["London", "Paris", "Berlin", "Madrid"],
        correctAnswer: "Paris",
      }),
    });
    r.status === 201 ? ok("TC-QN.2: Create second question") : fail("TC-QN.2: Create second question", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/quizzes/${testQuizId}/questions`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    Array.isArray(d) && d.length === 2
      ? ok("TC-QN.3: List questions (2)") : fail("TC-QN.3: List questions", `${d.length}`);
  }
  {
    const r = await fetch(`${BASE}/api/quizzes/${testQuizId}/questions/${testQuestionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ questionText: "What is 2 + 2?" }),
    });
    const d = await r.json();
    r.status === 200 && d.questionText === "What is 2 + 2?"
      ? ok("TC-QN.4: Update question text") : fail("TC-QN.4: Update question", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/quizzes/${testQuizId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({
        questionText: "Bad Q",
        options: ["A", "B", "C", "D"],
        correctAnswer: "Z",
      }),
    });
    r.status === 400 ? ok("TC-QN.5: Correct answer must be in options") : fail("TC-QN.5: Validation", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/quizzes/${testQuizId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({
        questionText: "Bad Q",
        options: ["A", "B"],
        correctAnswer: "A",
      }),
    });
    r.status === 400 ? ok("TC-QN.6: Exactly 4 options required") : fail("TC-QN.6: 4 options", `${r.status}`);
  }
}

// ─── Course Duplication ────────────────────────────────────

async function testCourseDuplicate() {
  console.log("\n═══ Course Duplication (FR-3.6) ═══");

  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/duplicate`, {
      method: "POST",
      headers: { Cookie: adminCookies },
    });
    const d = await r.json();
    r.status === 201 && d.id && d.title?.includes("(Copy)")
      ? ok("TC-D.1: Duplicate course (201)") : fail("TC-D.1: Duplicate course", `${r.status} ${d.title}`);
    duplicatedCourseId = d.id;
  }
  {
    const r = await fetch(`${BASE}/api/courses/${duplicatedCourseId}`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    d.modules?.length >= 2
      ? ok("TC-D.2: Duplicated course has modules") : fail("TC-D.2: Modules", `${d.modules?.length}`);
    const quizMod = d.modules?.find((m: { quiz: unknown }) => m.quiz);
    quizMod?.quiz?.questions?.length >= 2
      ? ok("TC-D.3: Duplicated quiz has questions") : fail("TC-D.3: Questions", `${quizMod?.quiz?.questions?.length}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${duplicatedCourseId}`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    d.status === "DRAFT"
      ? ok("TC-D.4: Duplicated course status is DRAFT") : fail("TC-D.4: Status", d.status);
  }
  {
    const r = await fetch(`${BASE}/api/courses/nonexistent/duplicate`, {
      method: "POST",
      headers: { Cookie: adminCookies },
    });
    r.status === 404 ? ok("TC-D.5: Duplicate non-existent (404)") : fail("TC-D.5: 404", `${r.status}`);
  }
}

// ─── Prerequisites ─────────────────────────────────────────

async function testPrerequisites() {
  console.log("\n═══ Prerequisites (FR-3.4) ═══");

  const seedCourse = await prisma.course.findFirst({ where: { id: { not: testCourseId } } });
  if (!seedCourse) { fail("No other course for prerequisite test"); return; }

  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/prerequisites`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ prerequisiteIds: [seedCourse.id] }),
    });
    r.status === 200 ? ok("TC-P.1: Set prerequisites") : fail("TC-P.1: Set prerequisites", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/prerequisites`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    Array.isArray(d) && d.length === 1 && d[0].prerequisiteCourse?.id === seedCourse.id
      ? ok("TC-P.2: Get prerequisites") : fail("TC-P.2: Get prerequisites", `${d.length}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/prerequisites`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ prerequisiteIds: [testCourseId] }),
    });
    r.status === 400 ? ok("TC-P.3: Self-prerequisite rejected") : fail("TC-P.3: Self-prereq", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/prerequisites`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ prerequisiteIds: [] }),
    });
    r.status === 200 ? ok("TC-P.4: Clear prerequisites") : fail("TC-P.4: Clear", `${r.status}`);
  }
}

// ─── Bulk User Import ──────────────────────────────────────

async function testBulkImport() {
  console.log("\n═══ Bulk User Import (FR-1.5) ═══");

  const csv = `name,email,role,password
Bulk User1,bulktest1@test.com,EMPLOYEE,BulkPass123!
Bulk User2,bulktest2@test.com,EMPLOYEE,BulkPass123!
Bulk User3,bulktest3@test.com,MANAGER,BulkPass123!`;

  bulkUserEmails.push("bulktest1@test.com", "bulktest2@test.com", "bulktest3@test.com");

  {
    const r = await fetch(`${BASE}/api/users/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ csv }),
    });
    const d = await r.json();
    r.status === 200 && d.created === 3 && d.errors === 0
      ? ok("TC-B.1: Bulk import 3 users") : fail("TC-B.1: Bulk import", `${r.status} created=${d.created} errors=${d.errors}`);
  }
  {
    const csvDup = `name,email,role,password
Dup User,bulktest1@test.com,EMPLOYEE,BulkPass123!`;
    const r = await fetch(`${BASE}/api/users/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ csv: csvDup }),
    });
    const d = await r.json();
    d.errors === 1 ? ok("TC-B.2: Duplicate email in CSV rejected") : fail("TC-B.2: Dup", `errors=${d.errors}`);
  }
  {
    const csvBad = `name,email,role,password
,bad-email,INVALID,short`;
    const r = await fetch(`${BASE}/api/users/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ csv: csvBad }),
    });
    const d = await r.json();
    d.errors === 1 ? ok("TC-B.3: Validation errors in CSV") : fail("TC-B.3: Validation", `errors=${d.errors}`);
  }
  {
    const r = await fetch(`${BASE}/api/users/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: employeeCookies },
      body: JSON.stringify({ csv }),
    });
    r.status === 403 ? ok("TC-B.4: Employee blocked from bulk import (403)") : fail("TC-B.4: Employee blocked", `${r.status}`);
  }
}

// ─── Bulk Status Update ────────────────────────────────────

async function testBulkStatus() {
  console.log("\n═══ Bulk Status Update (FR-1.5) ═══");

  const users = await prisma.user.findMany({ where: { email: { in: bulkUserEmails } } });
  const ids = users.map((u) => u.id);

  {
    const r = await fetch(`${BASE}/api/users/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ userIds: ids, status: "INACTIVE" }),
    });
    const d = await r.json();
    r.status === 200 && d.updated === ids.length
      ? ok("TC-BS.1: Bulk set INACTIVE") : fail("TC-BS.1: Bulk inactive", `${r.status} updated=${d.updated}`);
  }
  {
    const updated = await prisma.user.findMany({ where: { id: { in: ids } } });
    updated.every((u) => u.status === "INACTIVE")
      ? ok("TC-BS.2: All users now INACTIVE") : fail("TC-BS.2: Status check");
  }
  {
    const r = await fetch(`${BASE}/api/users/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      body: JSON.stringify({ userIds: ids, status: "ACTIVE" }),
    });
    const d = await r.json();
    d.updated === ids.length ? ok("TC-BS.3: Bulk set ACTIVE") : fail("TC-BS.3: Bulk active");
  }
  {
    const r = await fetch(`${BASE}/api/users/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: employeeCookies },
      body: JSON.stringify({ userIds: ids, status: "INACTIVE" }),
    });
    r.status === 403 ? ok("TC-BS.4: Employee blocked from bulk status (403)") : fail("TC-BS.4", `${r.status}`);
  }
}

// ─── Admin Reports API ─────────────────────────────────────

async function testReports() {
  console.log("\n═══ Admin Reports & Stats (FR-8.1, FR-8.5) ═══");

  {
    const r = await fetch(`${BASE}/api/admin/stats`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    r.status === 200 && typeof d.totalUsers === "number" && typeof d.totalCourses === "number"
      ? ok("TC-R.1: Admin stats endpoint") : fail("TC-R.1: Stats", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/admin/reports`, { headers: { Cookie: adminCookies } });
    const d = await r.json();
    r.status === 200 && typeof d.totalEnrollments === "number" && Array.isArray(d.monthlyEnrollments)
      ? ok("TC-R.2: Reports endpoint") : fail("TC-R.2: Reports", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/admin/reports`, { headers: { Cookie: employeeCookies } });
    r.status === 403 ? ok("TC-R.3: Employee blocked from reports (403)") : fail("TC-R.3", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/admin/stats`);
    r.status === 401 ? ok("TC-R.4: Unauthenticated blocked from stats (401)") : fail("TC-R.4", `${r.status}`);
  }
}

// ─── Delete & Cleanup ──────────────────────────────────────

async function testDeleteAndCleanup() {
  console.log("\n═══ Cleanup: Delete Test Data ═══");

  {
    const r = await fetch(`${BASE}/api/quizzes/${testQuizId}/questions/${testQuestionId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookies },
    });
    r.status === 204 ? ok("TC-CL.1: Delete question (204)") : fail("TC-CL.1: Delete question", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/modules/${testModuleId}/quiz`, {
      method: "DELETE",
      headers: { Cookie: adminCookies },
    });
    r.status === 204 ? ok("TC-CL.2: Delete quiz (204)") : fail("TC-CL.2: Delete quiz", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}/modules/${testModuleId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookies },
    });
    r.status === 204 ? ok("TC-CL.3: Delete module (204)") : fail("TC-CL.3: Delete module", `${r.status}`);
  }
  {
    const r = await fetch(`${BASE}/api/courses/${testCourseId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookies },
    });
    r.status === 204 ? ok("TC-CL.4: Delete test course (204)") : fail("TC-CL.4: Delete course", `${r.status}`);
  }
  if (duplicatedCourseId) {
    const r = await fetch(`${BASE}/api/courses/${duplicatedCourseId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookies },
    });
    r.status === 204 ? ok("TC-CL.5: Delete duplicated course (204)") : fail("TC-CL.5", `${r.status}`);
  }

  await prisma.user.deleteMany({ where: { email: { in: bulkUserEmails } } });
  ok("TC-CL.6: Bulk users cleaned up");
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Admin Module Integration Tests                            ║");
  console.log("║   Course, Module, Quiz, Question, Bulk, Reports             ║");
  console.log("║   Testing against: http://localhost:3000                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  try {
    const r = await fetch(`${BASE}/api/auth/csrf`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
  } catch {
    console.error("\n❌ Cannot reach dev server at http://localhost:3000\n");
    process.exit(1);
  }

  adminCookies = await login(ADMIN.email, ADMIN.password);
  employeeCookies = await login(EMPLOYEE.email, EMPLOYEE.password);

  try {
    await testCourseCRUD();
    await testModuleCRUD();
    await testQuizCRUD();
    await testQuestionCRUD();
    await testCourseDuplicate();
    await testPrerequisites();
    await testBulkImport();
    await testBulkStatus();
    await testReports();
    await testDeleteAndCleanup();
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: bulkUserEmails } } });
    await prisma.course.deleteMany({ where: { id: { in: [testCourseId, duplicatedCourseId].filter(Boolean) } } });
    await prisma.$disconnect();
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`  Results:  ✅ ${passed} passed   ❌ ${failed} failed`);
  console.log("══════════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main();
