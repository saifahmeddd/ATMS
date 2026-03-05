import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth-utils";

export async function GET() {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;

  const certificates = await prisma.certificate.findMany({
    where: { enrollment: { userId: session.user.id } },
    include: {
      enrollment: {
        include: {
          user: { select: { name: true } },
          course: { select: { id: true, title: true, category: true } },
          quizResults: {
            where: { passed: true },
            orderBy: { score: "desc" },
            take: 1,
            select: { score: true },
          },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  const result = certificates.map((cert) => ({
    id: cert.id,
    verificationCode: cert.verificationCode,
    issuedAt: cert.issuedAt,
    courseTitle: cert.enrollment.course.title,
    courseCategory: cert.enrollment.course.category,
    courseId: cert.enrollment.course.id,
    enrollmentId: cert.enrollmentId,
    bestScore: cert.enrollment.quizResults[0]?.score ?? null,
    employeeName: cert.enrollment.user.name,
  }));

  return NextResponse.json({ certificates: result });
}
