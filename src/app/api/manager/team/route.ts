import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  const authResult = await requireManager();
  if (authResult instanceof NextResponse) return authResult;

  const managerId = authResult.user.id;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";

  const where: Record<string, unknown> = { managerId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const members = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      enrollments: {
        select: {
          id: true,
          status: true,
          progressPct: true,
          deadline: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = members.map((member) => {
    const total = member.enrollments.length;
    const completed = member.enrollments.filter(
      (e) => e.status === "COMPLETED"
    ).length;
    const inProgress = member.enrollments.filter(
      (e) => e.status === "IN_PROGRESS" || e.status === "APPROVED"
    ).length;
    const overdue = member.enrollments.filter(
      (e) =>
        e.deadline &&
        new Date(e.deadline) < new Date() &&
        e.status !== "COMPLETED" &&
        e.status !== "REJECTED"
    ).length;

    const avgProgress =
      total > 0
        ? Math.round(
            member.enrollments.reduce((sum, e) => sum + e.progressPct, 0) / total
          )
        : 0;

    let status = "On Track";
    if (total > 0 && completed === total) status = "Completed";
    else if (avgProgress < 50 && total > 0) status = "Behind";

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      userStatus: member.status,
      joinedAt: member.createdAt,
      courses: total,
      completed,
      inProgress,
      overdue,
      progress: avgProgress,
      status,
    };
  });

  return NextResponse.json({ members: result });
}
