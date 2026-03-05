import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";

const createEnrollmentSchema = z.object({
  userId: z.string(),
  courseId: z.string(),
  deadline: z.string().datetime().optional(),
});

/**
 * GET /api/enrollments - List enrollments
 * Admin/Manager: all or filtered by userId, courseId, status
 * Employee: own enrollments only
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const status = searchParams.get("status") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | null;
  const userId = searchParams.get("userId");
  const courseId = searchParams.get("courseId");

  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};

  if (session.user.role === "EMPLOYEE") {
    where.userId = session.user.id;
  } else if (session.user.role === "MANAGER") {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: session.user.id },
      select: { id: true },
    });
    const teamIds = teamMembers.map((u) => u.id);
    if (userId && teamIds.includes(userId)) {
      where.userId = userId;
    } else {
      where.userId = { in: teamIds };
    }
  } else {
    if (userId) where.userId = userId;
  }
  if (courseId) where.courseId = courseId;
  if (status) where.status = status;

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, status: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return NextResponse.json({
    enrollments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * POST /api/enrollments - Create enrollment (Admin/Manager for assign, Employee for self-request)
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createEnrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, courseId, deadline } = parsed.data;

  // Employee can only enroll themselves (accept "self" as shorthand)
  const targetUserId =
    session.user.role === "EMPLOYEE" ? session.user.id : userId;
  const employeeSelfEnroll =
    session.user.role === "EMPLOYEE" &&
    (userId === "self" || userId === session.user.id);
  if (session.user.role === "EMPLOYEE" && !employeeSelfEnroll) {
    return NextResponse.json({ error: "Cannot enroll another user" }, { status: 403 });
  }

  // Admin/Manager can assign; Employee requests (PENDING)
  const status =
    session.user.role === "ADMIN"
      ? "APPROVED"
      : session.user.role === "MANAGER"
        ? "APPROVED"
        : "PENDING";
  const approvedById =
    status === "APPROVED" ? session.user.id : undefined;

  const existing = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId: targetUserId, courseId },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already enrolled in this course" },
      { status: 409 }
    );
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      userId: targetUserId,
      courseId,
      status,
      approvedById,
      deadline: deadline ? new Date(deadline) : undefined,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  if (session.user.role === "EMPLOYEE") {
    const employee = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { managerId: true },
    });
    if (employee?.managerId) {
      await createNotification({
        userId: employee.managerId,
        title: "New Enrollment Request",
        body: `${session.user.name} has requested enrollment in "${course.title}"`,
        type: "APPROVAL",
      });
    }
  }

  return NextResponse.json(enrollment, { status: 201 });
}
