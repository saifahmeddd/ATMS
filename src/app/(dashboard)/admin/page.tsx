"use client";

import {
  Users,
  BookOpen,
  Award,
  TrendingUp,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  trend = "neutral",
}: StatCardProps) {
  const trendClass =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="stat-card flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        {change && <p className={`text-xs mt-1 ${trendClass}`}>{change}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
    </div>
  );
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  pendingEnrollments: number;
  certificatesIssued: number;
  completionRate: number;
}

interface RecentEnrollment {
  id: string;
  status: string;
  enrolledAt: string;
  user: { name: string };
  course: { title: string };
}

interface CourseWithCount {
  id: string;
  title: string;
  category: string | null;
  status: string;
  _count: { enrollments: number };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentEnrollments, setRecentEnrollments] = useState<
    RecentEnrollment[]
  >([]);
  const [topCourses, setTopCourses] = useState<CourseWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, enrollRes, coursesRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/enrollments?limit=5"),
          fetch("/api/courses?limit=10"),
        ]);

        if (!statsRes.ok) throw new Error("Failed to load stats");
        const statsData = await statsRes.json();
        setStats(statsData);

        if (enrollRes.ok) {
          const enrollData = await enrollRes.json();
          setRecentEnrollments(enrollData.enrollments ?? []);
        }

        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          const sorted = (coursesData.courses ?? []).sort(
            (a: CourseWithCount, b: CourseWithCount) =>
              (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0)
          );
          setTopCourses(sorted.slice(0, 5));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Admin Dashboard</h1>
          <p className="page-subheader">Loading overview...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card h-24 animate-pulse bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Admin Dashboard</h1>
          <p className="page-subheader text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Admin Dashboard</h1>
        <p className="page-subheader">
          Overview of the training management system
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          change={stats ? `${stats.activeUsers} active` : undefined}
          icon={Users}
          trend="up"
        />
        <StatCard
          title="Active Courses"
          value={stats?.totalCourses ?? 0}
          icon={BookOpen}
          trend="up"
        />
        <StatCard
          title="Certificates Issued"
          value={stats?.certificatesIssued ?? 0}
          icon={Award}
          trend="up"
        />
        <StatCard
          title="Completion Rate"
          value={`${stats?.completionRate ?? 0}%`}
          change={stats ? `of ${stats.totalEnrollments} enrollments` : undefined}
          icon={TrendingUp}
          trend="up"
        />
      </div>

      {/* Recent Activity & Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Enrollments */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold text-foreground mb-4">
            Recent Enrollments
          </h2>
          <div className="space-y-3">
            {recentEnrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No enrollments yet
              </p>
            ) : (
              recentEnrollments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {item.user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2) ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.user?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.course?.title ?? "Unknown course"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === "APPROVED"
                          ? "bg-success/10 text-success"
                          : item.status === "REJECTED"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warning/10 text-warning"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(item.enrolledAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Overview */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold text-foreground mb-4">System Overview</h2>
          <div className="space-y-4">
            {[
              {
                label: "Pending Approvals",
                value: stats?.pendingEnrollments ?? 0,
                icon: Clock,
                color: "text-warning",
              },
              {
                label: "Active Users",
                value: stats?.activeUsers ?? 0,
                icon: Users,
                color: "text-info",
              },
              {
                label: "Completed Enrollments",
                value:
                  (stats?.totalEnrollments ?? 0) -
                  (stats?.pendingEnrollments ?? 0),
                icon: CheckCircle2,
                color: "text-success",
              },
              {
                label: "Total Courses",
                value: stats?.totalCourses ?? 0,
                icon: BookOpen,
                color: "text-primary",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popular Courses */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">
          Top Courses by Enrollment
        </h2>
        <div className="overflow-x-auto">
          {topCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No courses yet
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 font-medium">Course Name</th>
                  <th className="text-left py-3 font-medium">Category</th>
                  <th className="text-left py-3 font-medium">Enrolled</th>
                  <th className="text-left py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {topCourses.map((course) => (
                  <tr
                    key={course.id}
                    className="border-b last:border-0 hover:bg-secondary/50"
                  >
                    <td className="py-3 font-medium text-foreground">
                      {course.title}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {course.category ?? "—"}
                    </td>
                    <td className="py-3 text-foreground">
                      {course._count?.enrollments ?? 0}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          course.status === "PUBLISHED"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {course.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
