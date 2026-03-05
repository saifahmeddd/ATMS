import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";

const assignSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user required"),
  courseId: z.string(),
  deadline: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireManager();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userIds, courseId, deadline } = parsed.data;

  const teamMembers = await prisma.user.findMany({
    where: { managerId: session.user.id },
    select: { id: true },
  });
  const teamIds = new Set(teamMembers.map((u) => u.id));

  const unauthorized = userIds.filter((id) => !teamIds.has(id));
  if (unauthorized.length > 0) {
    return NextResponse.json(
      { error: "Some users are not in your team", unauthorized },
      { status: 403 }
    );
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, status: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Can only assign published courses" },
      { status: 400 }
    );
  }

  const existing = await prisma.enrollment.findMany({
    where: {
      courseId,
      userId: { in: userIds },
    },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e) => e.userId));

  const toAssign = userIds.filter((id) => !existingIds.has(id));
  const skipped = userIds.filter((id) => existingIds.has(id));

  if (toAssign.length > 0) {
    await prisma.enrollment.createMany({
      data: toAssign.map((userId) => ({
        userId,
        courseId,
        status: "APPROVED" as const,
        approvedById: session.user.id,
        deadline: deadline ? new Date(deadline) : null,
      })),
    });

    await Promise.all(
      toAssign.map((userId) =>
        createNotification({
          userId,
          title: "New Training Assigned",
          body: `You have been assigned to "${course.title}" by your manager.${deadline ? ` Deadline: ${new Date(deadline).toLocaleDateString()}` : ""}`,
          type: "GENERAL",
        })
      )
    );
  }

  return NextResponse.json({
    assigned: toAssign.length,
    skipped: skipped.length,
    details: {
      assignedUserIds: toAssign,
      skippedUserIds: skipped,
    },
  });
}
