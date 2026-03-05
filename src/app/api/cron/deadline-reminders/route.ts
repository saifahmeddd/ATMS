import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const now = new Date();
  const reminders = [
    { days: 7, label: "7 days" },
    { days: 3, label: "3 days" },
    { days: 1, label: "1 day" },
  ];

  let created = 0;

  for (const { days, label } of reminders) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const enrollments = await prisma.enrollment.findMany({
      where: {
        deadline: { gte: startOfDay, lte: endOfDay },
        status: { in: ["APPROVED", "IN_PROGRESS"] },
      },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { title: true } },
      },
    });

    for (const enrollment of enrollments) {
      const bodyText = `Your deadline for "${enrollment.course.title}" is in ${label}. Current progress: ${enrollment.progressPct}%.`;

      const existing = await prisma.notification.findFirst({
        where: {
          userId: enrollment.userId,
          type: "REMINDER",
          body: bodyText,
        },
      });

      if (!existing) {
        await createNotification({
          userId: enrollment.userId,
          title: "Deadline Reminder",
          body: bodyText,
          type: "REMINDER",
          emailPayload: {
            courseTitle: enrollment.course.title,
            daysLeft: days,
            progressPct: enrollment.progressPct,
          },
        });
        created++;
      }
    }
  }

  return NextResponse.json({ remindersCreated: created });
}
