import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth-utils";

export async function GET() {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const userId = session.user.id;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: { select: { id: true, title: true } },
      userProgress: {
        orderBy: { completedAt: "desc" },
        take: 5,
        where: { completedAt: { not: null } },
        include: { module: { select: { title: true } } },
      },
    },
  });

  const totalEnrollments = enrollments.length;
  const completed = enrollments.filter((e) => e.status === "COMPLETED").length;
  const inProgress = enrollments.filter((e) => e.status === "IN_PROGRESS").length;
  const pending = enrollments.filter((e) => e.status === "PENDING").length;

  const activeEnrollments = enrollments.filter((e) =>
    ["APPROVED", "IN_PROGRESS"].includes(e.status)
  );
  const averageProgress =
    activeEnrollments.length > 0
      ? Math.round(
          activeEnrollments.reduce((sum, e) => sum + e.progressPct, 0) /
            activeEnrollments.length
        )
      : 0;

  const certificateCount = await prisma.certificate.count({
    where: { enrollment: { userId } },
  });

  // Average quiz score
  const quizResults = await prisma.quizResult.findMany({
    where: { enrollment: { userId }, passed: true },
    select: { score: true },
  });
  const avgScore =
    quizResults.length > 0
      ? Math.round(quizResults.reduce((s, r) => s + r.score, 0) / quizResults.length)
      : 0;

  const upcomingDeadlines = enrollments
    .filter(
      (e) =>
        e.deadline &&
        ["APPROVED", "IN_PROGRESS"].includes(e.status) &&
        new Date(e.deadline) > new Date()
    )
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5)
    .map((e) => ({
      enrollmentId: e.id,
      courseTitle: e.course.title,
      courseId: e.course.id,
      deadline: e.deadline,
      progressPct: e.progressPct,
    }));

  const continueLearning = enrollments
    .filter((e) => ["APPROVED", "IN_PROGRESS"].includes(e.status))
    .sort((a, b) => b.progressPct - a.progressPct)
    .slice(0, 3)
    .map((e) => ({
      enrollmentId: e.id,
      courseTitle: e.course.title,
      courseId: e.course.id,
      progressPct: e.progressPct,
      deadline: e.deadline,
    }));

  // Enrich continueLearning with module counts
  const courseIds = continueLearning.map((c) => c.courseId);
  const moduleCounts = await prisma.module.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courseIds } },
    _count: true,
  });
  const moduleCountMap = new Map(moduleCounts.map((mc) => [mc.courseId, mc._count]));

  const progressCounts = await prisma.userProgress.groupBy({
    by: ["enrollmentId"],
    where: {
      enrollmentId: { in: continueLearning.map((c) => c.enrollmentId) },
      completedAt: { not: null },
    },
    _count: true,
  });
  const progCountMap = new Map(progressCounts.map((pc) => [pc.enrollmentId, pc._count]));

  const enrichedContinue = continueLearning.map((c) => ({
    ...c,
    totalModules: moduleCountMap.get(c.courseId) ?? 0,
    completedModules: progCountMap.get(c.enrollmentId) ?? 0,
  }));

  const recentActivity = enrollments
    .flatMap((e) =>
      e.userProgress.map((p) => ({
        moduleTitle: p.module.title,
        courseTitle: e.course.title,
        completedAt: p.completedAt,
      }))
    )
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 5);

  return NextResponse.json({
    totalEnrollments,
    completed,
    inProgress,
    pending,
    averageProgress,
    certificateCount,
    avgScore,
    upcomingDeadlines,
    continueLearning: enrichedContinue,
    recentActivity,
  });
}
