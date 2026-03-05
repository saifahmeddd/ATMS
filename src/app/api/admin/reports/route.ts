import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const [
    totalEnrollments,
    completedEnrollments,
    avgQuizScore,
    coursesByCategory,
    enrollmentsByMonth,
  ] = await Promise.all([
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: "COMPLETED" } }),
    prisma.quizResult.aggregate({ _avg: { score: true } }),
    prisma.course.groupBy({
      by: ["category"],
      _count: { id: true },
      where: { category: { not: null } },
    }),
    prisma.$queryRaw<{ month: number; count: bigint }[]>`
      SELECT EXTRACT(MONTH FROM enrolled_at)::int AS month, COUNT(*)::bigint AS count
      FROM enrollments
      WHERE enrolled_at >= DATE_TRUNC('year', CURRENT_DATE)
      GROUP BY month
      ORDER BY month
    `,
  ]);

  const completionRate = totalEnrollments > 0
    ? Math.round((completedEnrollments / totalEnrollments) * 100)
    : 0;

  const monthlyEnrollments = Array.from({ length: 12 }, (_, i) => {
    const found = enrollmentsByMonth.find((e) => e.month === i + 1);
    return { month: i + 1, count: found ? Number(found.count) : 0 };
  });

  const categories = coursesByCategory.map((c) => ({
    category: c.category ?? "Uncategorized",
    count: c._count.id,
  }));
  const totalCourses = categories.reduce((sum, c) => sum + c.count, 0);
  const categoryDistribution = categories.map((c) => ({
    ...c,
    percentage: totalCourses > 0 ? Math.round((c.count / totalCourses) * 100) : 0,
  }));

  return NextResponse.json({
    totalEnrollments,
    completedEnrollments,
    completionRate,
    avgQuizScore: Math.round(avgQuizScore._avg.score ?? 0),
    monthlyEnrollments,
    categoryDistribution,
  });
}
