import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";

const adminManagerSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});

const employeeCancelSchema = z.object({
  status: z.literal("CANCELLED"),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { id } = await params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, managerId: true } },
      course: { select: { id: true, title: true, status: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  if (session.user.role === "EMPLOYEE" && enrollment.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(enrollment);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, managerId: true } },
      course: { select: { id: true, title: true } },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  // Employee cancellation path
  if (session.user.role === "EMPLOYEE") {
    const parsed = employeeCancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Employees can only cancel enrollments" },
        { status: 403 }
      );
    }

    if (enrollment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const canCancel =
      enrollment.status === "PENDING" ||
      (enrollment.status === "APPROVED" && enrollment.progressPct === 0);

    if (!canCancel) {
      return NextResponse.json(
        { error: "Can only cancel PENDING or APPROVED enrollments with no progress" },
        { status: 400 }
      );
    }

    const updated = await prisma.enrollment.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(updated);
  }

  // Admin/Manager approval/rejection path
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = adminManagerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (enrollment.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only PENDING enrollments can be approved or rejected" },
      { status: 400 }
    );
  }

  if (
    session.user.role === "MANAGER" &&
    enrollment.user.managerId !== session.user.id
  ) {
    return NextResponse.json(
      { error: "You can only manage enrollments for your own team members" },
      { status: 403 }
    );
  }

  const { status, comment } = parsed.data;

  const updated = await prisma.enrollment.update({
    where: { id },
    data: {
      status,
      approvedById: session.user.id,
      comment: comment ?? null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  const notifType = status === "APPROVED" ? "APPROVAL" : "REJECTION";
  const verb = status === "APPROVED" ? "approved" : "rejected";
  await createNotification({
    userId: enrollment.user.id,
    title: `Enrollment ${verb}`,
    body: `Your enrollment for "${enrollment.course.title}" has been ${verb}.${comment ? ` Comment: ${comment}` : ""}`,
    type: notifType,
    emailPayload: {
      courseTitle: enrollment.course.title,
      approved: status === "APPROVED",
      comment,
    },
  });

  return NextResponse.json(updated);
}
