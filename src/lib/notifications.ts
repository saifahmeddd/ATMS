import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";
import {
  sendEnrollmentNotificationEmail,
  sendCertificateEmail,
  sendDeadlineReminderEmail,
} from "@/lib/email";

export async function createNotification(params: {
  userId: string;
  title: string;
  body?: string;
  type: NotificationType;
  /** Optional: send email if user has email notifications enabled */
  emailPayload?: {
    courseTitle?: string;
    approved?: boolean;
    comment?: string;
    daysLeft?: number;
    progressPct?: number;
  };
}) {
  const notif = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body ?? null,
      type: params.type,
    },
  });

  // FR-9.1: Send email if user has email notifications enabled
  if (params.emailPayload) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, notificationPrefs: true },
    });
    const prefs = (user?.notificationPrefs as Record<string, boolean> | null) ?? { email: true };
    if (user?.email && (prefs.email ?? true)) {
      try {
        if (params.type === "APPROVAL" || params.type === "REJECTION") {
          await sendEnrollmentNotificationEmail(
            user.email,
            params.emailPayload.courseTitle ?? "Course",
            params.emailPayload.approved ?? false,
            params.emailPayload.comment
          );
        } else if (params.type === "CERTIFICATE") {
          await sendCertificateEmail(
            user.email,
            params.emailPayload.courseTitle ?? "Course"
          );
        } else if (params.type === "REMINDER" && params.emailPayload.daysLeft != null) {
          await sendDeadlineReminderEmail(
            user.email,
            params.emailPayload.courseTitle ?? "Course",
            params.emailPayload.daysLeft,
            params.emailPayload.progressPct ?? 0
          );
        }
      } catch (err) {
        console.error("Failed to send notification email:", err);
      }
    }
  }

  return notif;
}
