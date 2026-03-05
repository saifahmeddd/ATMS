import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEmployee();
  if (authResult instanceof NextResponse) return authResult;

  const session = authResult;
  const { id } = await params;

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: {
      enrollment: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true, category: true, description: true } },
          quizResults: {
            where: { passed: true },
            orderBy: { score: "desc" },
            take: 1,
            select: { score: true },
          },
        },
      },
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  if (certificate.enrollment.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: certificate.id,
    verificationCode: certificate.verificationCode,
    issuedAt: certificate.issuedAt,
    employeeName: certificate.enrollment.user.name,
    employeeEmail: certificate.enrollment.user.email,
    courseTitle: certificate.enrollment.course.title,
    courseCategory: certificate.enrollment.course.category,
    courseDescription: certificate.enrollment.course.description,
    bestScore: certificate.enrollment.quizResults[0]?.score ?? null,
    completedAt: certificate.enrollment.enrolledAt,
  });
}
