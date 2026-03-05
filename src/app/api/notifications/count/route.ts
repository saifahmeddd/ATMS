import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const unread = await prisma.notification.count({
    where: { userId: authResult.user.id, read: false },
  });

  return NextResponse.json({ unread });
}
