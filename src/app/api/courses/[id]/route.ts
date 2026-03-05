import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  category: z.string().optional().nullable(),
});

/**
 * GET /api/courses/[id] - Get course by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      modules: {
        orderBy: { sequence: "asc" },
        include: { quiz: { include: { questions: true } } },
      },
      prerequisites: {
        include: { prerequisiteCourse: { select: { id: true, title: true, status: true } } },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(course);
}

/**
 * PATCH /api/courses/[id] - Update course (Admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const updated = await prisma.course.update({
    where: { id },
    data: parsed.data,
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/courses/[id] - Delete course (Admin only)
 */
export async function DELETE(
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

  await prisma.course.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
