import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  const authResult = await requireManager();
  if (authResult instanceof NextResponse) return authResult;

  const managerId = authResult.user.id;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const teamMembers = await prisma.user.findMany({
    where: { managerId },
    select: { id: true, name: true },
  });
  const teamIds = teamMembers.map((u) => u.id);

  if (teamIds.length === 0) {
    return NextResponse.json({
      teamOverview: {
        totalMembers: 0,
        totalEnrollments: 0,
        completions: 0,
        avgProgress: 0,
      },
      memberBreakdown: [],
      courseBreakdown: [],
    });
  }

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const enrollmentWhere: Record<string, unknown> = {
    userId: { in: teamIds },
  };
  if (from || to) {
    enrollmentWhere.enrolledAt = dateFilter;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: enrollmentWhere,
    include: {
      user: { select: { id: true, name: true } },
      course: { select: { id: true, title: true, category: true } },
      quizResults: { select: { score: true } },
    },
  });

  const totalEnrollments = enrollments.length;
  const completions = enrollments.filter((e) => e.status === "COMPLETED").length;
  const avgProgress =
    totalEnrollments > 0
      ? Math.round(
          enrollments.reduce((sum, e) => sum + e.progressPct, 0) / totalEnrollments
        )
      : 0;

  const memberMap = new Map<
    string,
    {
      name: string;
      enrollments: number;
      completed: number;
      scores: number[];
      totalProgress: number;
    }
  >();

  for (const e of enrollments) {
    const entry = memberMap.get(e.user.id) ?? {
      name: e.user.name,
      enrollments: 0,
      completed: 0,
      scores: [],
      totalProgress: 0,
    };
    entry.enrollments++;
    entry.totalProgress += e.progressPct;
    if (e.status === "COMPLETED") entry.completed++;
    for (const qr of e.quizResults) entry.scores.push(qr.score);
    memberMap.set(e.user.id, entry);
  }

  const memberBreakdown = Array.from(memberMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    enrollments: data.enrollments,
    completed: data.completed,
    avgScore:
      data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
    avgProgress: Math.round(data.totalProgress / data.enrollments),
  }));

  const courseMap = new Map<
    string,
    { title: string; enrolled: number; completed: number; scores: number[] }
  >();

  for (const e of enrollments) {
    const entry = courseMap.get(e.course.id) ?? {
      title: e.course.title,
      enrolled: 0,
      completed: 0,
      scores: [],
    };
    entry.enrolled++;
    if (e.status === "COMPLETED") entry.completed++;
    for (const qr of e.quizResults) entry.scores.push(qr.score);
    courseMap.set(e.course.id, entry);
  }

  const courseBreakdown = Array.from(courseMap.entries()).map(([id, data]) => ({
    id,
    title: data.title,
    enrolled: data.enrolled,
    completed: data.completed,
    avgScore:
      data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
  }));

  return NextResponse.json({
    teamOverview: {
      totalMembers: teamIds.length,
      totalEnrollments,
      completions,
      avgProgress,
    },
    memberBreakdown,
    courseBreakdown,
  });
}
