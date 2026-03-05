import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

const setPrerequisitesSchema = z.object({
  prerequisiteIds: z.array(z.string()),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const prerequisites = await prisma.coursePrerequisite.findMany({
    where: { courseId: id },
    include: {
      prerequisiteCourse: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json(prerequisites);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = setPrerequisitesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const selfRef = parsed.data.prerequisiteIds.includes(id);
  if (selfRef) {
    return NextResponse.json(
      { error: "A course cannot be its own prerequisite" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.coursePrerequisite.deleteMany({ where: { courseId: id } }),
    ...parsed.data.prerequisiteIds.map((prereqId) =>
      prisma.coursePrerequisite.create({
        data: { courseId: id, prerequisiteCourseId: prereqId },
      })
    ),
  ]);

  const updated = await prisma.coursePrerequisite.findMany({
    where: { courseId: id },
    include: {
      prerequisiteCourse: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json(updated);
}
