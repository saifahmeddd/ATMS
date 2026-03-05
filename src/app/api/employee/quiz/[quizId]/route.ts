import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { quizId } = await params;
  const { searchParams } = new URL(request.url);
  const enrollmentId = searchParams.get("enrollmentId");

  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId is required" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
  });
  if (!enrollment || enrollment.userId !== session.user.id) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        select: { id: true, questionText: true, options: true },
      },
      module: { select: { title: true, courseId: true } },
    },
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  if (quiz.module.courseId !== enrollment.courseId) {
    return NextResponse.json({ error: "Quiz does not belong to this course" }, { status: 400 });
  }

  const attemptCount = await prisma.quizResult.count({
    where: { enrollmentId, quizId },
  });

  const bestResult = await prisma.quizResult.findFirst({
    where: { enrollmentId, quizId, passed: true },
    select: { score: true, passed: true },
  });

  return NextResponse.json({
    id: quiz.id,
    moduleTitle: quiz.module.title,
    passingScore: quiz.passingScore,
    durationMinutes: quiz.durationMinutes,
    maxAttempts: quiz.maxAttempts,
    attemptsTaken: attemptCount,
    attemptsRemaining: quiz.maxAttempts - attemptCount,
    alreadyPassed: !!bestResult,
    questions: quiz.questions,
  });
}
