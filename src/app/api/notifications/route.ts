import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const userId = authResult.user.id;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const where: Record<string, unknown> = { userId };
  if (unreadOnly) where.read = false;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return NextResponse.json({
    notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

const markReadSchema = z.union([
  z.object({ ids: z.array(z.string()).min(1) }),
  z.object({ markAllRead: z.literal(true) }),
]);

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const userId = authResult.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide { ids: string[] } or { markAllRead: true }" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if ("markAllRead" in data) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { id: { in: data.ids }, userId },
      data: { read: true },
    });
  }

  return NextResponse.json({ success: true });
}
