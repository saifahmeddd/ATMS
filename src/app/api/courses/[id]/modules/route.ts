import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

const createModuleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["VIDEO", "PDF", "DOCUMENT"]),
  contentUrl: z.string().min(1, "Content URL is required"),
  sequence: z.number().int().min(0).optional(),
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

  const modules = await prisma.module.findMany({
    where: { courseId: id },
    orderBy: { sequence: "asc" },
    include: { quiz: { include: { _count: { select: { questions: true } } } } },
  });

  return NextResponse.json(modules);
}

export async function POST(
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

  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let sequence = parsed.data.sequence;
  if (sequence === undefined) {
    const last = await prisma.module.findFirst({
      where: { courseId: id },
      orderBy: { sequence: "desc" },
    });
    sequence = (last?.sequence ?? -1) + 1;
  }

  const mod = await prisma.module.create({
    data: {
      courseId: id,
      title: parsed.data.title,
      type: parsed.data.type,
      contentUrl: parsed.data.contentUrl,
      sequence,
    },
  });

  return NextResponse.json(mod, { status: 201 });
}
