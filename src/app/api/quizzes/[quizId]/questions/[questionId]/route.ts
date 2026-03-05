import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

const updateQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  options: z.array(z.string()).length(4).optional(),
  correctAnswer: z.string().min(1).optional(),
  explanation: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { quizId, questionId } = await params;

  const question = await prisma.question.findFirst({
    where: { id: questionId, quizId },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const opts = parsed.data.options ?? (question.options as string[]);
  const correct = parsed.data.correctAnswer ?? question.correctAnswer;
  if (!opts.includes(correct)) {
    return NextResponse.json(
      { error: "Correct answer must be one of the options" },
      { status: 400 }
    );
  }

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { quizId, questionId } = await params;

  const question = await prisma.question.findFirst({
    where: { id: questionId, quizId },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  await prisma.question.delete({ where: { id: questionId } });
  return new NextResponse(null, { status: 204 });
}
