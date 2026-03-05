"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, CheckCircle2, Play } from "lucide-react";

interface Enrollment {
  id: string;
  status: string;
  progressPct: number;
  deadline: string | null;
  course: { id: string; title: string };
}

export default function MyCoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enrollments?limit=50")
      .then((r) => r.json())
      .then((data) => setEnrollments(data.enrollments))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">My Courses</h1>
          <p className="page-subheader">View your enrolled and completed courses</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-lg border h-64 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const active = enrollments.filter((e) => !["REJECTED", "CANCELLED"].includes(e.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">My Courses</h1>
        <p className="page-subheader">View your enrolled and completed courses</p>
      </div>

      {active.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No courses yet. <Link href="/employee/catalogue" className="text-primary hover:underline">Browse the catalogue</Link></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((e) => {
            const isCompleted = e.status === "COMPLETED";
            const isPending = e.status === "PENDING";
            const statusLabel = e.status === "IN_PROGRESS" ? "In Progress" : e.status === "APPROVED" ? "Ready to Start" : e.status;
            const statusClass = isCompleted
              ? "bg-success/10 text-success"
              : isPending
                ? "bg-warning/10 text-warning"
                : "bg-info/10 text-info";

            return (
              <div key={e.id} className="bg-card rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-28 bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center relative">
                  {isCompleted ? (
                    <CheckCircle2 className="w-10 h-10 text-success/50" />
                  ) : (
                    <Play className="w-10 h-10 text-primary/30" />
                  )}
                  <span className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full ${statusClass}`}>{statusLabel}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1">{e.course.title}</h3>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">{e.progressPct}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${e.progressPct === 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${e.progressPct}%` }} />
                    </div>
                  </div>
                  {e.deadline && !isCompleted && (
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Due: {new Date(e.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                  {isCompleted ? (
                    <Link
                      href="/employee/certificates"
                      className="block w-full mt-3 py-2 text-xs font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-center"
                    >
                      View Certificate
                    </Link>
                  ) : isPending ? (
                    <div className="mt-3 py-2 text-xs font-medium text-center text-muted-foreground">Awaiting Approval</div>
                  ) : (
                    <Link
                      href={`/employee/my-courses/${e.id}`}
                      className="block w-full mt-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-center"
                    >
                      Continue Learning
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
