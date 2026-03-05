import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth-utils";

const submitSchema = z.object({
  enrollmentId: z.string(),
  answers: z.record(z.string(), z.string()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { quizId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { enrollmentId, answers } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
  });
  if (!enrollment || enrollment.userId !== session.user.id) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: true,
      module: { select: { courseId: true } },
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

  if (attemptCount >= quiz.maxAttempts) {
    return NextResponse.json({ error: "Maximum attempts exceeded" }, { status: 400 });
  }

  // Grade the quiz
  let correct = 0;
  const questionResults = quiz.questions.map((q) => {
    const userAnswer = answers[q.id] ?? "";
    const isCorrect = userAnswer === q.correctAnswer;
    if (isCorrect) correct++;
    return {
      questionId: q.id,
      questionText: q.questionText,
      options: q.options,
      userAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: (q as { explanation?: string | null }).explanation ?? null,
    };
  });

  const score = quiz.questions.length > 0
    ? Math.round((correct / quiz.questions.length) * 100)
    : 0;
  const passed = score >= quiz.passingScore;

  const result = await prisma.quizResult.create({
    data: {
      enrollmentId,
      quizId,
      score,
      passed,
      answers: answers as Record<string, string>,
    },
  });

  return NextResponse.json({
    id: result.id,
    score,
    passed,
    passingScore: quiz.passingScore,
    correctCount: correct,
    totalQuestions: quiz.questions.length,
    attemptsUsed: attemptCount + 1,
    attemptsRemaining: quiz.maxAttempts - (attemptCount + 1),
    questionResults,
  });
}
