import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const session = authResult;

  const source = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { sequence: "asc" },
        include: { quiz: { include: { questions: true } } },
      },
      prerequisites: true,
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const newCourse = await prisma.course.create({
    data: {
      title: `${source.title} (Copy)`,
      description: source.description,
      thumbnailUrl: source.thumbnailUrl,
      status: "DRAFT",
      category: source.category,
      createdById: session.user.id,
    },
  });

  for (const mod of source.modules) {
    const newMod = await prisma.module.create({
      data: {
        courseId: newCourse.id,
        title: mod.title,
        type: mod.type,
        contentUrl: mod.contentUrl,
        sequence: mod.sequence,
      },
    });

    if (mod.quiz) {
      const newQuiz = await prisma.quiz.create({
        data: {
          moduleId: newMod.id,
          passingScore: mod.quiz.passingScore,
          durationMinutes: mod.quiz.durationMinutes,
          maxAttempts: mod.quiz.maxAttempts,
        },
      });

      if (mod.quiz.questions.length > 0) {
        await prisma.question.createMany({
          data: mod.quiz.questions.map((q) => ({
            quizId: newQuiz.id,
            questionText: q.questionText,
            options: q.options as unknown as string[],
            correctAnswer: q.correctAnswer,
          })),
        });
      }
    }
  }

  if (source.prerequisites.length > 0) {
    await prisma.coursePrerequisite.createMany({
      data: source.prerequisites.map((p) => ({
        courseId: newCourse.id,
        prerequisiteCourseId: p.prerequisiteCourseId,
      })),
    });
  }

  const result = await prisma.course.findUnique({
    where: { id: newCourse.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { modules: true, enrollments: true } },
    },
  });

  return NextResponse.json(result, { status: 201 });
}
