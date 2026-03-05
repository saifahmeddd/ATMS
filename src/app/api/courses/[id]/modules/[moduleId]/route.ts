import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

const updateModuleSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(["VIDEO", "PDF", "DOCUMENT"]).optional(),
  contentUrl: z.string().min(1).optional(),
  sequence: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id, moduleId } = await params;

  const mod = await prisma.module.findFirst({
    where: { id: moduleId, courseId: id },
  });
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await prisma.module.update({
    where: { id: moduleId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { id, moduleId } = await params;

  const mod = await prisma.module.findFirst({
    where: { id: moduleId, courseId: id },
  });
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  await prisma.module.delete({ where: { id: moduleId } });
  return new NextResponse(null, { status: 204 });
}
