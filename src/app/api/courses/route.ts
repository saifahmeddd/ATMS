import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

const createCourseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().default("DRAFT"),
  category: z.string().optional().nullable(),
});

/**
 * GET /api/courses - List courses (Admin only for now)
 * Query params: page, limit, status, category
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const status = searchParams.get("status") as "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
  const category = searchParams.get("category") ?? "";
  const search = searchParams.get("search") ?? "";

  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (search) where.title = { contains: search, mode: "insensitive" };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return NextResponse.json({
    courses,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * POST /api/courses - Create course (Admin only)
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const session = authResult;
  const course = await prisma.course.create({
    data: {
      ...parsed.data,
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(course, { status: 201 });
}
