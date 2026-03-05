import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

/**
 * GET /api/admin/stats - Dashboard statistics (Admin only)
 */
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const [
    totalUsers,
    activeUsers,
    totalCourses,
    totalEnrollments,
    pendingEnrollments,
    certificatesIssued,
    completedEnrollments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: "PENDING" } }),
    prisma.certificate.count(),
    prisma.enrollment.count({ where: { status: "COMPLETED" } }),
  ]);

  const completionRate =
    totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0;

  return NextResponse.json({
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    totalCourses,
    totalEnrollments,
    pendingEnrollments,
    certificatesIssued,
    completionRate,
  });
}
