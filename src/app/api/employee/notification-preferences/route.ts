import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

const prefsSchema = z.object({
  email: z.boolean().optional(),
  inApp: z.boolean().optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPrefs: true },
  });

  const defaults = { email: true, inApp: true };
  const prefs = (user?.notificationPrefs as Record<string, boolean> | null) ?? defaults;

  return NextResponse.json({ email: prefs.email ?? true, inApp: prefs.inApp ?? true });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPrefs: true },
  });

  const current = (user?.notificationPrefs as Record<string, boolean> | null) ?? { email: true, inApp: true };
  const updated = { ...current, ...parsed.data };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPrefs: updated },
  });

  return NextResponse.json(updated);
}
