import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth-utils";

/**
 * GET /api/employee/transcript - User transcript (FR-8.7)
 * Returns finished courses and grades for the authenticated employee
 */
export async function GET() {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;

  const completedEnrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    include: {
      course: { select: { id: true, title: true, category: true } },
      quizResults: {
        where: { passed: true },
        orderBy: { score: "desc" },
        select: { score: true, quizId: true },
      },
      certificate: { select: { verificationCode: true, issuedAt: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const transcript = completedEnrollments.map((e) => {
    const bestScore = e.quizResults[0]?.score ?? null;
    const allScores = e.quizResults.map((r) => r.score);
    const avgGrade =
      allScores.length > 0
        ? Math.round(
            allScores.reduce((a, b) => a + b, 0) / allScores.length
          )
        : null;

    return {
      courseId: e.course.id,
      courseTitle: e.course.title,
      category: e.course.category,
      completedAt: e.certificate?.issuedAt ?? e.enrolledAt,
      grade: bestScore ?? avgGrade,
      progressPct: e.progressPct,
      verificationCode: e.certificate?.verificationCode ?? null,
    };
  });

  return NextResponse.json({ transcript });
}
