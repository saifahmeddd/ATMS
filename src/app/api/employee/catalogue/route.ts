import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (category) where.category = category;

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { modules: true, enrollments: true } },
        prerequisites: {
          include: { prerequisiteCourse: { select: { id: true, title: true } } },
        },
      },
    }),
    prisma.course.count({ where }),
  ]);

  const employeeEnrollments = await prisma.enrollment.findMany({
    where: {
      userId: session.user.id,
      courseId: { in: courses.map((c) => c.id) },
    },
    select: { courseId: true, status: true, id: true },
  });
  const enrollmentMap = new Map(employeeEnrollments.map((e) => [e.courseId, e]));

  const completedCourseIds = new Set(
    (
      await prisma.enrollment.findMany({
        where: { userId: session.user.id, status: "COMPLETED" },
        select: { courseId: true },
      })
    ).map((e) => e.courseId)
  );

  const categories = await prisma.course.findMany({
    where: { status: "PUBLISHED", category: { not: null } },
    select: { category: true },
    distinct: ["category"],
  });

  const enriched = courses.map((course) => {
    const enrollment = enrollmentMap.get(course.id);
    const prereqsMet = course.prerequisites.every((p) =>
      completedCourseIds.has(p.prerequisiteCourseId)
    );
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      category: course.category,
      createdAt: course.createdAt,
      moduleCount: course._count.modules,
      enrolledCount: course._count.enrollments,
      prerequisites: course.prerequisites.map((p) => ({
        courseId: p.prerequisiteCourseId,
        title: p.prerequisiteCourse.title,
        met: completedCourseIds.has(p.prerequisiteCourseId),
      })),
      prereqsMet,
      enrollment: enrollment
        ? { id: enrollment.id, status: enrollment.status }
        : null,
    };
  });

  return NextResponse.json({
    courses: enriched,
    categories: categories.map((c) => c.category).filter(Boolean),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
