import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId, status: "PUBLISHED" },
    include: {
      modules: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          contentUrl: true,
          sequence: true,
          quiz: { select: { id: true, passingScore: true, durationMinutes: true, maxAttempts: true } },
        },
      },
      prerequisites: {
        include: { prerequisiteCourse: { select: { id: true, title: true } } },
      },
      _count: { select: { enrollments: true, modules: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: {
      userProgress: { select: { moduleId: true, completedAt: true, videoProgress: true, lastPosition: true } },
      quizResults: { select: { quizId: true, score: true, passed: true } },
    },
  });

  const completedCourseIds = new Set(
    (
      await prisma.enrollment.findMany({
        where: { userId: session.user.id, status: "COMPLETED" },
        select: { courseId: true },
      })
    ).map((e) => e.courseId)
  );

  const prereqs = course.prerequisites.map((p) => ({
    courseId: p.prerequisiteCourseId,
    title: p.prerequisiteCourse.title,
    met: completedCourseIds.has(p.prerequisiteCourseId),
  }));

  const completedModuleIds = new Set(
    enrollment?.userProgress.filter((p) => p.completedAt).map((p) => p.moduleId) ?? []
  );

  const passedQuizIds = new Set(
    enrollment?.quizResults.filter((r) => r.passed).map((r) => r.quizId) ?? []
  );

  const modules = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type,
    contentUrl: m.contentUrl,
    sequence: m.sequence,
    completed: completedModuleIds.has(m.id),
    hasQuiz: !!m.quiz,
    quizId: m.quiz?.id ?? null,
    quizPassed: m.quiz ? passedQuizIds.has(m.quiz.id) : null,
    videoProgress: enrollment?.userProgress.find((p) => p.moduleId === m.id)?.videoProgress ?? 0,
    lastPosition: enrollment?.userProgress.find((p) => p.moduleId === m.id)?.lastPosition ?? 0,
  }));

  return NextResponse.json({
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: course.category,
    createdAt: course.createdAt,
    createdBy: course.createdBy.name,
    moduleCount: course._count.modules,
    enrolledCount: course._count.enrollments,
    modules,
    prerequisites: prereqs,
    prereqsMet: prereqs.every((p) => p.met),
    enrollment: enrollment
      ? {
          id: enrollment.id,
          status: enrollment.status,
          progressPct: enrollment.progressPct,
          deadline: enrollment.deadline,
          enrolledAt: enrollment.enrolledAt,
        }
      : null,
  });
}
