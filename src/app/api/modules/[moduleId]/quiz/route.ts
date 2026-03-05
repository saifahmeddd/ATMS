import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

const createQuizSchema = z.object({
  passingScore: z.number().int().min(0).max(100),
  durationMinutes: z.number().int().min(1),
  maxAttempts: z.number().int().min(1).optional().default(3),
});

const updateQuizSchema = z.object({
  passingScore: z.number().int().min(0).max(100).optional(),
  durationMinutes: z.number().int().min(1).optional(),
  maxAttempts: z.number().int().min(1).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { moduleId } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { moduleId },
    include: { questions: true },
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  return NextResponse.json(quiz);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { moduleId } = await params;

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const existing = await prisma.quiz.findUnique({ where: { moduleId } });
  if (existing) {
    return NextResponse.json({ error: "Module already has a quiz" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createQuizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const quiz = await prisma.quiz.create({
    data: { moduleId, ...parsed.data },
    include: { questions: true },
  });

  return NextResponse.json(quiz, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { moduleId } = await params;

  const quiz = await prisma.quiz.findUnique({ where: { moduleId } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateQuizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await prisma.quiz.update({
    where: { moduleId },
    data: parsed.data,
    include: { questions: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { moduleId } = await params;

  const quiz = await prisma.quiz.findUnique({ where: { moduleId } });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  await prisma.quiz.delete({ where: { moduleId } });
  return new NextResponse(null, { status: 204 });
}
