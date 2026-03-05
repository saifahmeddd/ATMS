import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/verify-certificate?code=CERT-XXXXXXXX
 * Public endpoint - no auth required. Verifies certificate authenticity (FR-7.5)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code || !code.startsWith("CERT-")) {
    return NextResponse.json(
      { valid: false, error: "Invalid verification code format" },
      { status: 400 }
    );
  }

  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode: code.toUpperCase() },
    include: {
      enrollment: {
        include: {
          user: { select: { name: true } },
          course: { select: { title: true, category: true } },
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
    return NextResponse.json({
      valid: false,
      message: "Certificate not found. The verification code may be invalid or the certificate may have been revoked.",
    });
  }

  return NextResponse.json({
    valid: true,
    certificate: {
      verificationCode: certificate.verificationCode,
      courseTitle: certificate.enrollment.course.title,
      category: certificate.enrollment.course.category,
      recipientName: certificate.enrollment.user.name,
      issuedAt: certificate.issuedAt,
      score: certificate.enrollment.quizResults[0]?.score ?? null,
    },
  });
}
