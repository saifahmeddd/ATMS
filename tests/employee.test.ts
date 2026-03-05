/**
 * Employee Module Integration Tests
 * Covers: Course browsing, enrollment, progress tracking, quizzes,
 *         certificates, profile, notifications, dashboard stats
 *
 * Usage: npx tsx tests/employee.test.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
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

async function api(path: string, cookie: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, { ...opts, headers: { Cookie: cookie, "Content-Type": "application/json", ...opts?.headers } });
}

// ─── Test Data ──────────────────────────────────────────

const TEST_PREFIX = "emptest_";
let employeeCookie = "";
let managerCookie = "";
let adminCookie = "";
let employeeId = "";
let managerId = "";
let adminId = "";
let testCourseId = "";
let testModule1Id = "";
let testModule2Id = "";
let testModule3Id = "";
let testQuizId = "";
let testEnrollmentId = "";

// ─── Setup ──────────────────────────────────────────

async function setup() {
  console.log("\n🔧  Setting up test data...\n");

  // Clean previous test data
  await prisma.certificate.deleteMany({ where: { enrollment: { user: { email: { startsWith: TEST_PREFIX } } } } });
  await prisma.quizResult.deleteMany({ where: { enrollment: { user: { email: { startsWith: TEST_PREFIX } } } } });
  await prisma.userProgress.deleteMany({ where: { enrollment: { user: { email: { startsWith: TEST_PREFIX } } } } });
  await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
  await prisma.question.deleteMany({ where: { quiz: { module: { course: { title: { startsWith: TEST_PREFIX } } } } } });
  await prisma.quiz.deleteMany({ where: { module: { course: { title: { startsWith: TEST_PREFIX } } } } });
  await prisma.module.deleteMany({ where: { course: { title: { startsWith: TEST_PREFIX } } } });
  await prisma.coursePrerequisite.deleteMany({ where: { course: { title: { startsWith: TEST_PREFIX } } } });
  await prisma.course.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });

  const hash = await bcrypt.hash("Test1234!", 10);

  const admin = await prisma.user.create({
    data: { name: "Test Admin", email: `${TEST_PREFIX}admin@test.com`, passwordHash: hash, role: "ADMIN" },
  });
  adminId = admin.id;

  const manager = await prisma.user.create({
    data: { name: "Test Manager", email: `${TEST_PREFIX}manager@test.com`, passwordHash: hash, role: "MANAGER" },
  });
  managerId = manager.id;

  const employee = await prisma.user.create({
    data: { name: "Test Employee", email: `${TEST_PREFIX}employee@test.com`, passwordHash: hash, role: "EMPLOYEE", managerId: manager.id },
  });
  employeeId = employee.id;

  // Create a published course with 3 modules + 1 quiz
  const course = await prisma.course.create({
    data: {
      title: `${TEST_PREFIX}Web Development`,
      description: "Learn web development",
      status: "PUBLISHED",
      category: "Technical",
      createdById: adminId,
    },
  });
  testCourseId = course.id;

  const m1 = await prisma.module.create({
    data: { courseId: testCourseId, title: "HTML Basics", type: "VIDEO", contentUrl: "https://youtube.com/watch?v=test1", sequence: 1 },
  });
  testModule1Id = m1.id;

  const m2 = await prisma.module.create({
    data: { courseId: testCourseId, title: "CSS Fundamentals", type: "PDF", contentUrl: "https://example.com/css.pdf", sequence: 2 },
  });
  testModule2Id = m2.id;

  const m3 = await prisma.module.create({
    data: { courseId: testCourseId, title: "JavaScript Intro", type: "VIDEO", contentUrl: "https://youtube.com/watch?v=test3", sequence: 3 },
  });
  testModule3Id = m3.id;

  const quiz = await prisma.quiz.create({
    data: { moduleId: testModule2Id, passingScore: 50, durationMinutes: 10, maxAttempts: 2 },
  });
  testQuizId = quiz.id;

  await prisma.question.createMany({
    data: [
      { quizId: testQuizId, questionText: "What does CSS stand for?", options: ["Cascading Style Sheets", "Creative Style System", "Computer Style Sheets", "Cool Style Syntax"], correctAnswer: "Cascading Style Sheets" },
      { quizId: testQuizId, questionText: "Which property sets text color?", options: ["font-color", "text-color", "color", "foreground"], correctAnswer: "color" },
    ],
  });

  // Login all users
  adminCookie = await login(`${TEST_PREFIX}admin@test.com`, "Test1234!");
  managerCookie = await login(`${TEST_PREFIX}manager@test.com`, "Test1234!");
  employeeCookie = await login(`${TEST_PREFIX}employee@test.com`, "Test1234!");

  console.log("  Setup complete.\n");
}

// ─── Tests ──────────────────────────────────────────

async function runTests() {
  // ── Access Control ─────────────────────────
  console.log("── Access Control ──");

  {
    const res = await api("/api/employee/stats", adminCookie);
    res.status === 403 ? ok("Admin cannot access employee stats") : fail("Admin access to employee stats", `Status ${res.status}`);
    await res.json().catch(() => {});
  }

  {
    const res = await api("/api/employee/stats", employeeCookie);
    res.status === 200 ? ok("Employee can access own stats") : fail("Employee stats access", `Status ${res.status}`);
    await res.json().catch(() => {});
  }

  // ── Course Browsing (FR-5.1) ─────────────────────────
  console.log("\n── Course Browsing ──");

  {
    const res = await api("/api/employee/catalogue", employeeCookie);
    const data = await res.json();
    if (res.status === 200 && data.courses.length > 0) ok("Browse catalogue returns courses");
    else fail("Browse catalogue", `Status ${res.status}, courses: ${data.courses?.length}`);
  }

  {
    const res = await api(`/api/employee/catalogue?search=${TEST_PREFIX}Web`, employeeCookie);
    const data = await res.json();
    const found = data.courses.some((c: { title: string }) => c.title.includes(TEST_PREFIX));
    found ? ok("Search by title works") : fail("Search by title");
  }

  {
    const res = await api("/api/employee/catalogue?category=Technical", employeeCookie);
    const data = await res.json();
    const allTech = data.courses.every((c: { category: string }) => c.category === "Technical");
    allTech ? ok("Filter by category works") : fail("Filter by category");
  }

  {
    const res = await api(`/api/employee/catalogue/${testCourseId}`, employeeCookie);
    const data = await res.json();
    if (res.status === 200 && data.modules && data.modules.length === 3) ok("Course detail returns modules");
    else fail("Course detail", `Status ${res.status}, modules: ${data.modules?.length}`);
  }

  // ── Enrollment (FR-5.2, FR-5.8) ─────────────────────────
  console.log("\n── Enrollment ──");

  {
    const res = await api("/api/enrollments", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ userId: employeeId, courseId: testCourseId }),
    });
    const data = await res.json();
    if (res.status === 201 && data.status === "PENDING") {
      testEnrollmentId = data.id;
      ok("Employee self-enrolls (PENDING)");
    } else {
      fail("Self-enrollment", `Status ${res.status}, status: ${data.status}`);
    }
  }

  {
    const res = await api("/api/enrollments", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ userId: employeeId, courseId: testCourseId }),
    });
    res.status === 409 ? ok("Duplicate enrollment blocked") : fail("Duplicate enrollment", `Status ${res.status}`);
    await res.json().catch(() => {});
  }

  // Cancel PENDING enrollment
  {
    const res = await api(`/api/enrollments/${testEnrollmentId}`, employeeCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "CANCELLED") ok("Employee cancels PENDING enrollment");
    else fail("Cancel PENDING", `Status ${res.status}, data: ${JSON.stringify(data)}`);
  }

  // Re-enroll and approve
  await prisma.enrollment.delete({ where: { id: testEnrollmentId } });
  {
    const res = await api("/api/enrollments", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ userId: employeeId, courseId: testCourseId }),
    });
    const data = await res.json();
    testEnrollmentId = data.id;
  }

  // Manager approves
  {
    const res = await api(`/api/enrollments/${testEnrollmentId}`, managerCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const data = await res.json();
    data.status === "APPROVED" ? ok("Manager approves enrollment") : fail("Manager approve", `Status ${res.status}`);
  }

  // Cancel APPROVED with 0 progress
  {
    const res = await api(`/api/enrollments/${testEnrollmentId}`, employeeCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "CANCELLED") ok("Employee cancels APPROVED enrollment with 0 progress");
    else fail("Cancel APPROVED", `Status ${res.status}`);
  }

  // Re-enroll and approve for progress tests
  await prisma.enrollment.delete({ where: { id: testEnrollmentId } });
  {
    const enr = await prisma.enrollment.create({
      data: { userId: employeeId, courseId: testCourseId, status: "APPROVED", approvedById: managerId },
    });
    testEnrollmentId = enr.id;
  }

  // ── Progress Tracking (FR-6.1 - FR-6.7) ─────────────────────────
  console.log("\n── Progress Tracking ──");

  // Save video progress (auto-save)
  {
    const res = await api("/api/employee/progress", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, moduleId: testModule1Id, videoProgress: 50, lastPosition: 120 }),
    });
    const data = await res.json();
    if (res.status === 200 && data.videoProgress === 50) ok("Save video progress (auto-save)");
    else fail("Save video progress", `Status ${res.status}`);
  }

  // Get progress
  {
    const res = await api(`/api/employee/progress?enrollmentId=${testEnrollmentId}`, employeeCookie);
    const data = await res.json();
    const m1 = data.modules?.find((m: { moduleId: string }) => m.moduleId === testModule1Id);
    if (m1 && m1.lastPosition === 120) ok("Resume position saved and returned");
    else fail("Resume position", JSON.stringify(m1));
  }

  // Sequential unlock enforcement — try completing module 3 before module 1
  {
    const res = await api("/api/employee/progress", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, moduleId: testModule3Id, completed: true }),
    });
    res.status === 400 ? ok("Sequential unlock enforced (cannot skip)") : fail("Sequential unlock", `Status ${res.status}`);
    await res.json().catch(() => {});
  }

  // Complete module 1
  {
    const res = await api("/api/employee/progress", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, moduleId: testModule1Id, completed: true }),
    });
    const data = await res.json();
    if (res.status === 200) ok("Complete module 1");
    else fail("Complete module 1", `Status ${res.status}`);
  }

  // Enrollment should now be IN_PROGRESS
  {
    const enr = await prisma.enrollment.findUnique({ where: { id: testEnrollmentId } });
    enr?.status === "IN_PROGRESS" ? ok("Enrollment status changed to IN_PROGRESS") : fail("IN_PROGRESS status", enr?.status ?? "null");
  }

  // Cannot cancel enrollment with progress
  {
    const res = await api(`/api/enrollments/${testEnrollmentId}`, employeeCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    res.status === 400 ? ok("Cannot cancel enrollment with progress") : fail("Cancel with progress", `Status ${res.status}`);
    await res.json().catch(() => {});
  }

  // Progress percentage auto-calculated
  {
    const enr = await prisma.enrollment.findUnique({ where: { id: testEnrollmentId } });
    if (enr && enr.progressPct === 33) ok("Progress percentage auto-calculated (33%)");
    else fail("Progress calculation", `progressPct: ${enr?.progressPct}`);
  }

  // ── Quiz (FR-4.4, FR-4.5, FR-4.7, FR-4.8) ─────────────────────────
  console.log("\n── Quiz ──");

  // Complete module 2 first (for quiz)
  {
    const res = await api("/api/employee/progress", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, moduleId: testModule2Id, completed: true }),
    });
    res.status === 200 ? ok("Complete module 2 (has quiz)") : fail("Complete module 2", `Status ${res.status}`);
    await res.json().catch(() => {});
  }

  // Load quiz — no correct answers
  {
    const res = await api(`/api/employee/quiz/${testQuizId}?enrollmentId=${testEnrollmentId}`, employeeCookie);
    const data = await res.json();
    const hasCorrectAnswer = data.questions?.some((q: Record<string, unknown>) => "correctAnswer" in q);
    if (res.status === 200 && !hasCorrectAnswer && data.questions?.length === 2) ok("Load quiz (no correct answers in response)");
    else fail("Load quiz", `Status ${res.status}, hasCorrectAnswer: ${hasCorrectAnswer}`);
  }

  // Get question IDs
  const questions = await prisma.question.findMany({ where: { quizId: testQuizId } });

  // Submit quiz — fail intentionally
  {
    const wrongAnswers: Record<string, string> = {};
    for (const q of questions) wrongAnswers[q.id] = "wrong answer";

    const res = await api(`/api/employee/quiz/${testQuizId}/submit`, employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, answers: wrongAnswers }),
    });
    const data = await res.json();
    if (res.status === 200 && !data.passed && data.score === 0) ok("Failed quiz result recorded (0%)");
    else fail("Failed quiz", `Status ${res.status}, score: ${data.score}, passed: ${data.passed}`);
  }

  // Submit quiz — pass
  {
    const correctAnswers: Record<string, string> = {};
    for (const q of questions) correctAnswers[q.id] = q.correctAnswer;

    const res = await api(`/api/employee/quiz/${testQuizId}/submit`, employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, answers: correctAnswers }),
    });
    const data = await res.json();
    if (res.status === 200 && data.passed && data.score === 100) ok("Passed quiz with correct answers returned");
    else fail("Passed quiz", `Status ${res.status}, score: ${data.score}, passed: ${data.passed}`);

    const hasResults = data.questionResults?.every((q: { correctAnswer: string }) => q.correctAnswer);
    hasResults ? ok("Correct answers returned after submission (FR-4.7)") : fail("Correct answers in result");
  }

  // Max attempts enforced
  {
    const wrongAnswers: Record<string, string> = {};
    for (const q of questions) wrongAnswers[q.id] = "wrong";

    const res = await api(`/api/employee/quiz/${testQuizId}/submit`, employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, answers: wrongAnswers }),
    });
    res.status === 400 ? ok("Max attempts enforced") : fail("Max attempts", `Status ${res.status}`);
    await res.json().catch(() => {});
  }

  // ── Course Completion & Certificate (FR-7.1, FR-7.4) ─────────────────────────
  console.log("\n── Course Completion & Certificates ──");

  // Complete module 3 (final module)
  {
    const res = await api("/api/employee/progress", employeeCookie, {
      method: "POST",
      body: JSON.stringify({ enrollmentId: testEnrollmentId, moduleId: testModule3Id, completed: true }),
    });
    const data = await res.json();
    if (res.status === 200 && data.courseCompleted) ok("Course completion detected when all modules done");
    else fail("Course completion", `Status ${res.status}, courseCompleted: ${data.courseCompleted}`);
  }

  // Enrollment should be COMPLETED
  {
    const enr = await prisma.enrollment.findUnique({ where: { id: testEnrollmentId } });
    enr?.status === "COMPLETED" ? ok("Enrollment status set to COMPLETED") : fail("COMPLETED status", enr?.status ?? "null");
  }

  // Certificate auto-generated
  {
    const cert = await prisma.certificate.findUnique({ where: { enrollmentId: testEnrollmentId } });
    cert ? ok("Certificate auto-generated") : fail("Certificate creation");
  }

  // Certificate notification sent
  {
    const notif = await prisma.notification.findFirst({
      where: { userId: employeeId, type: "CERTIFICATE" },
    });
    notif ? ok("CERTIFICATE notification sent") : fail("Certificate notification");
  }

  // List certificates
  {
    const res = await api("/api/employee/certificates", employeeCookie);
    const data = await res.json();
    if (res.status === 200 && data.certificates?.length >= 1) ok("List certificates");
    else fail("List certificates", `Status ${res.status}, count: ${data.certificates?.length}`);
  }

  // Get single certificate
  {
    const cert = await prisma.certificate.findUnique({ where: { enrollmentId: testEnrollmentId } });
    if (cert) {
      const res = await api(`/api/employee/certificates/${cert.id}`, employeeCookie);
      const data = await res.json();
      if (res.status === 200 && data.verificationCode) ok("Get single certificate detail");
      else fail("Single certificate", `Status ${res.status}`);
    }
  }

  // ── Notifications (FR-9.1 - FR-9.6) ─────────────────────────
  console.log("\n── Notifications ──");

  // Enrollment approval notification should exist
  {
    const notif = await prisma.notification.findFirst({
      where: { userId: employeeId, type: "APPROVAL" },
    });
    notif ? ok("Enrollment approval notification received") : fail("Approval notification");
  }

  // List notifications with pagination
  {
    const res = await api("/api/notifications?limit=5", employeeCookie);
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.notifications)) ok("List notifications");
    else fail("List notifications", `Status ${res.status}`);
  }

  // Mark notification as read
  {
    const notifs = await prisma.notification.findMany({ where: { userId: employeeId, read: false }, take: 1 });
    if (notifs.length > 0) {
      const res = await api("/api/notifications", employeeCookie, {
        method: "PATCH",
        body: JSON.stringify({ ids: [notifs[0].id] }),
      });
      if (res.status === 200) {
        const updated = await prisma.notification.findUnique({ where: { id: notifs[0].id } });
        updated?.read ? ok("Mark notification as read") : fail("Mark read — not updated");
      } else {
        fail("Mark notification as read", `Status ${res.status}`);
        await res.json().catch(() => {});
      }
    } else {
      ok("Mark notification as read (no unread to test — skip)");
    }
  }

  // ── Profile (FR-1.6) ─────────────────────────
  console.log("\n── Profile ──");

  {
    const res = await api("/api/employee/profile", employeeCookie);
    const data = await res.json();
    if (res.status === 200 && data.name === "Test Employee") ok("Get profile");
    else fail("Get profile", `Status ${res.status}, name: ${data.name}`);
  }

  {
    const res = await api("/api/employee/profile", employeeCookie, {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Employee", phone: "+60123456789" }),
    });
    const data = await res.json();
    if (res.status === 200 && data.name === "Updated Employee" && data.phone === "+60123456789") ok("Update name and phone");
    else fail("Update profile", `Status ${res.status}`);
  }

  // Notification preferences
  {
    const res = await api("/api/employee/notification-preferences", employeeCookie, {
      method: "PATCH",
      body: JSON.stringify({ email: false, inApp: true }),
    });
    const data = await res.json();
    if (res.status === 200 && data.email === false && data.inApp === true) ok("Update notification preferences");
    else fail("Notification prefs", `Status ${res.status}`);
  }

  // ── Dashboard Stats ─────────────────────────
  console.log("\n── Dashboard Stats ──");

  {
    const res = await api("/api/employee/stats", employeeCookie);
    const data = await res.json();
    if (res.status === 200 && data.completed >= 1 && data.certificateCount >= 1) ok("Stats reflect correct counts");
    else fail("Dashboard stats", `Status ${res.status}, completed: ${data.completed}, certs: ${data.certificateCount}`);
  }

  // ── Deadline Reminders ─────────────────────────
  console.log("\n── Deadline Reminders ──");

  // Create an enrollment with a 3-day deadline for testing
  const reminderCourse = await prisma.course.create({
    data: { title: `${TEST_PREFIX}Reminder Course`, status: "PUBLISHED", category: "Test", createdById: adminId },
  });
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  await prisma.enrollment.create({
    data: { userId: employeeId, courseId: reminderCourse.id, status: "IN_PROGRESS", deadline: threeDaysFromNow },
  });

  {
    const res = await fetch(`${BASE}/api/cron/deadline-reminders`, { method: "POST" });
    const data = await res.json();
    if (res.status === 200 && data.remindersCreated >= 1) ok("Deadline reminders created");
    else fail("Deadline reminders", `Status ${res.status}, created: ${data.remindersCreated}`);
  }
}

// ─── Cleanup ──────────────────────────────────────────

async function cleanup() {
  console.log("\n🧹  Cleaning up test data...\n");
  await prisma.certificate.deleteMany({ where: { enrollment: { user: { email: { startsWith: TEST_PREFIX } } } } });
  await prisma.quizResult.deleteMany({ where: { enrollment: { user: { email: { startsWith: TEST_PREFIX } } } } });
  await prisma.userProgress.deleteMany({ where: { enrollment: { user: { email: { startsWith: TEST_PREFIX } } } } });
  await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
  await prisma.question.deleteMany({ where: { quiz: { module: { course: { title: { startsWith: TEST_PREFIX } } } } } });
  await prisma.quiz.deleteMany({ where: { module: { course: { title: { startsWith: TEST_PREFIX } } } } });
  await prisma.module.deleteMany({ where: { course: { title: { startsWith: TEST_PREFIX } } } });
  await prisma.coursePrerequisite.deleteMany({ where: { course: { title: { startsWith: TEST_PREFIX } } } });
  await prisma.course.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
}

// ─── Main ──────────────────────────────────────────

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error("\n💥  Unexpected error:", err);
    failed++;
  } finally {
    await cleanup();
    await prisma.$disconnect();
    console.log(`\n════════════════════════════════════════`);
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log(`════════════════════════════════════════\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
