import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-utils";

export async function GET() {
  const authResult = await requireManager();
  if (authResult instanceof NextResponse) return authResult;

  const managerId = authResult.user.id;

  const teamMembers = await prisma.user.findMany({
    where: { managerId },
    select: { id: true },
  });
  const teamIds = teamMembers.map((u) => u.id);
  const teamSize = teamIds.length;

  if (teamSize === 0) {
    return NextResponse.json({
      teamSize: 0,
      activeEnrollments: 0,
      pendingApprovals: 0,
      completionRate: 0,
      recentCompletions: [],
      teamProgress: [],
      pendingRequests: [],
    });
  }

  const [activeEnrollments, pendingApprovals, completedCount, totalNonPending] =
    await Promise.all([
      prisma.enrollment.count({
        where: { userId: { in: teamIds }, status: "IN_PROGRESS" },
      }),
      prisma.enrollment.count({
        where: { userId: { in: teamIds }, status: "PENDING" },
      }),
      prisma.enrollment.count({
        where: { userId: { in: teamIds }, status: "COMPLETED" },
      }),
      prisma.enrollment.count({
        where: {
          userId: { in: teamIds },
          status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] },
        },
      }),
    ]);

  const completionRate =
    totalNonPending > 0 ? Math.round((completedCount / totalNonPending) * 100) : 0;

  const pendingRequests = await prisma.enrollment.findMany({
    where: { userId: { in: teamIds }, status: "PENDING" },
    orderBy: { enrolledAt: "desc" },
    take: 5,
    include: {
      user: { select: { id: true, name: true } },
      course: { select: { id: true, title: true } },
    },
  });

  const teamProgressRaw = await prisma.user.findMany({
    where: { id: { in: teamIds } },
    select: {
      id: true,
      name: true,
      enrollments: {
        select: { status: true, progressPct: true },
      },
    },
  });

  const teamProgress = teamProgressRaw.map((member) => {
    const total = member.enrollments.length;
    const completed = member.enrollments.filter(
      (e) => e.status === "COMPLETED"
    ).length;
    const avgProgress =
      total > 0
        ? Math.round(
            member.enrollments.reduce((sum, e) => sum + e.progressPct, 0) / total
          )
        : 0;
    return {
      id: member.id,
      name: member.name,
      courses: total,
      progress: avgProgress,
      completed,
    };
  });

  return NextResponse.json({
    teamSize,
    activeEnrollments,
    pendingApprovals,
    completionRate,
    pendingRequests,
    teamProgress,
  });
}
