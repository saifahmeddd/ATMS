import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

/**
 * GET /api/admin/quiz-analytics - Quiz analytics (FR-8.6)
 * Returns average grades per quiz, per-question pass rates (complexity proxy)
 */
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const quizzes = await prisma.quiz.findMany({
    include: {
      module: { select: { id: true, title: true, courseId: true, course: { select: { title: true } } } },
      questions: true,
      quizResults: true,
    },
  });

  const analytics = quizzes.map((quiz) => {
    const results = quiz.quizResults;
    const totalAttempts = results.length;
    const avgScore =
      totalAttempts > 0
        ? Math.round(
            results.reduce((sum, r) => sum + r.score, 0) / totalAttempts
          )
        : 0;
    const passRate =
      totalAttempts > 0
        ? Math.round(
            (results.filter((r) => r.passed).length / totalAttempts) * 100
          )
        : 0;

    // Per-question complexity: % of attempts that got this question correct
    const questionStats = quiz.questions.map((q) => {
      const correctCount = results.filter((r) => {
        const answers = r.answers as Record<string, string> | null;
        return answers?.[q.id] === q.correctAnswer;
      }).length;
      const correctRate =
        totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
      return {
        questionId: q.id,
        questionText: q.questionText.slice(0, 80) + (q.questionText.length > 80 ? "..." : ""),
        correctRate,
        difficulty: correctRate >= 80 ? "Easy" : correctRate >= 50 ? "Medium" : "Hard",
      };
    });

    return {
      quizId: quiz.id,
      moduleTitle: quiz.module.title,
      courseTitle: quiz.module.course.title,
      passingScore: quiz.passingScore,
      totalAttempts,
      avgScore,
      passRate,
      questionStats,
    };
  });

  const overallAvg =
    analytics.length > 0
      ? Math.round(
          analytics.reduce((sum, a) => sum + a.avgScore, 0) / analytics.length
        )
      : 0;

  return NextResponse.json({
    quizzes: analytics,
    overallAvgScore: overallAvg,
  });
}
