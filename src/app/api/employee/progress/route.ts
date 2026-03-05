import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";
import { randomUUID } from "crypto";

const saveProgressSchema = z.object({
  enrollmentId: z.string(),
  moduleId: z.string(),
  videoProgress: z.number().int().min(0).max(100).optional(),
  lastPosition: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { searchParams } = new URL(request.url);
  const enrollmentId = searchParams.get("enrollmentId");

  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId is required" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { userId: true, courseId: true, status: true, progressPct: true },
  });

  if (!enrollment || enrollment.userId !== session.user.id) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const modules = await prisma.module.findMany({
    where: { courseId: enrollment.courseId },
    orderBy: { sequence: "asc" },
    select: { id: true, title: true, type: true, sequence: true, quiz: { select: { id: true } } },
  });

  const progress = await prisma.userProgress.findMany({
    where: { enrollmentId },
  });
  const progressMap = new Map(progress.map((p) => [p.moduleId, p]));

  const quizResults = await prisma.quizResult.findMany({
    where: { enrollmentId },
    select: { quizId: true, passed: true, score: true },
  });
  const passedQuizMap = new Map<string, boolean>();
  for (const r of quizResults) {
    if (r.passed) passedQuizMap.set(r.quizId, true);
  }

  const moduleProgress = modules.map((m) => {
    const prog = progressMap.get(m.id);
    return {
      moduleId: m.id,
      title: m.title,
      type: m.type,
      sequence: m.sequence,
      videoProgress: prog?.videoProgress ?? 0,
      lastPosition: prog?.lastPosition ?? 0,
      completed: !!prog?.completedAt,
      completedAt: prog?.completedAt ?? null,
      hasQuiz: !!m.quiz,
      quizId: m.quiz?.id ?? null,
      quizPassed: m.quiz ? (passedQuizMap.get(m.quiz.id) ?? false) : null,
    };
  });

  return NextResponse.json({
    enrollmentId,
    status: enrollment.status,
    progressPct: enrollment.progressPct,
    modules: moduleProgress,
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = saveProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { enrollmentId, moduleId, videoProgress, lastPosition, completed } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: { include: { modules: { orderBy: { sequence: "asc" }, include: { quiz: { select: { id: true } } } } } } },
  });

  if (!enrollment || enrollment.userId !== session.user.id) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  if (!["APPROVED", "IN_PROGRESS"].includes(enrollment.status)) {
    return NextResponse.json({ error: "Enrollment is not active" }, { status: 400 });
  }

  const courseModules = enrollment.course.modules;
  const targetModule = courseModules.find((m) => m.id === moduleId);
  if (!targetModule) {
    return NextResponse.json({ error: "Module not found in this course" }, { status: 404 });
  }

  // Sequential unlock enforcement for completion
  if (completed) {
    const prevModules = courseModules.filter((m) => m.sequence < targetModule.sequence);
    if (prevModules.length > 0) {
      const prevProgress = await prisma.userProgress.findMany({
        where: {
          enrollmentId,
          moduleId: { in: prevModules.map((m) => m.id) },
          completedAt: { not: null },
        },
      });
      const completedPrevIds = new Set(prevProgress.map((p) => p.moduleId));

      for (const prev of prevModules) {
        if (!completedPrevIds.has(prev.id)) {
          return NextResponse.json(
            { error: "Previous modules must be completed first" },
            { status: 400 }
          );
        }
        if (prev.quiz) {
          const quizPassed = await prisma.quizResult.findFirst({
            where: { enrollmentId, quizId: prev.quiz.id, passed: true },
          });
          if (!quizPassed) {
            return NextResponse.json(
              { error: `Quiz for "${prev.title}" must be passed first` },
              { status: 400 }
            );
          }
        }
      }
    }
  }

  const upserted = await prisma.userProgress.upsert({
    where: { enrollmentId_moduleId: { enrollmentId, moduleId } },
    create: {
      enrollmentId,
      moduleId,
      videoProgress: videoProgress ?? 0,
      lastPosition: lastPosition ?? 0,
      completedAt: completed ? new Date() : null,
    },
    update: {
      videoProgress: videoProgress ?? undefined,
      lastPosition: lastPosition ?? undefined,
      ...(completed ? { completedAt: new Date() } : {}),
    },
  });

  // Update enrollment status to IN_PROGRESS if it was APPROVED
  if (enrollment.status === "APPROVED") {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "IN_PROGRESS" },
    });
  }

  // Recalculate progress percentage
  const allProgress = await prisma.userProgress.findMany({
    where: { enrollmentId, completedAt: { not: null } },
  });
  const totalModules = courseModules.length;
  const completedModules = allProgress.length;
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { progressPct },
  });

  // Check if course is complete (all modules done + all quizzes passed)
  if (completedModules === totalModules) {
    const modulesWithQuiz = courseModules.filter((m) => m.quiz);
    let allQuizzesPassed = true;
    for (const m of modulesWithQuiz) {
      const passed = await prisma.quizResult.findFirst({
        where: { enrollmentId, quizId: m.quiz!.id, passed: true },
      });
      if (!passed) {
        allQuizzesPassed = false;
        break;
      }
    }

    if (allQuizzesPassed) {
      const existing = await prisma.certificate.findUnique({
        where: { enrollmentId },
      });

      if (!existing) {
        await prisma.enrollment.update({
          where: { id: enrollmentId },
          data: { status: "COMPLETED", progressPct: 100 },
        });

        const verificationCode = `CERT-${randomUUID().slice(0, 8).toUpperCase()}`;
        await prisma.certificate.create({
          data: { enrollmentId, verificationCode },
        });

        await createNotification({
          userId: session.user.id,
          title: "Course Completed!",
          body: `Congratulations! You've completed "${enrollment.course.title}". Your certificate is ready.`,
          type: "CERTIFICATE",
          emailPayload: { courseTitle: enrollment.course.title },
        });
      }
    }
  }

  return NextResponse.json({
    ...upserted,
    progressPct,
    courseCompleted: completedModules === totalModules,
  });
}
