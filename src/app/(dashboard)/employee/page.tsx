"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, Award, TrendingUp, Play, CheckCircle2 } from "lucide-react";

interface Stats {
  totalEnrollments: number;
  completed: number;
  inProgress: number;
  pending: number;
  certificateCount: number;
  avgScore: number;
  continueLearning: {
    enrollmentId: string;
    courseTitle: string;
    courseId: string;
    progressPct: number;
    deadline: string | null;
    totalModules: number;
    completedModules: number;
  }[];
  upcomingDeadlines: {
    enrollmentId: string;
    courseTitle: string;
    deadline: string;
    progressPct: number;
  }[];
}

export default function EmployeeDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employee/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">My Dashboard</h1>
          <p className="page-subheader">Track your learning progress and upcoming training</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card h-24 animate-pulse bg-secondary/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats!;
  const isUrgent = (d: string) => {
    const diff = new Date(d).getTime() - Date.now();
    return diff < 3 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">My Dashboard</h1>
        <p className="page-subheader">Track your learning progress and upcoming training</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Enrolled Courses</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.totalEnrollments}</p>
            <p className="text-xs text-info mt-1">{s.inProgress} in progress</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.completed}</p>
            <p className="text-xs text-success mt-1">{s.completed > 0 ? "All passed" : "None yet"}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
        </div>
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Certificates</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.certificateCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.certificateCount > 0 ? "Downloadable" : "None yet"}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Award className="w-5 h-5 text-accent" />
          </div>
        </div>
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Avg. Score</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.avgScore}%</p>
            <p className="text-xs text-success mt-1">{s.avgScore >= 80 ? "Above average" : s.avgScore > 0 ? "Keep going" : "No quizzes yet"}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-warning" />
          </div>
        </div>
      </div>

      {/* Continue Learning */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">Continue Learning</h2>
        {s.continueLearning.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses in progress. <Link href="/employee/catalogue" className="text-primary hover:underline">Browse the catalogue</Link> to get started.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {s.continueLearning.map((course) => (
              <div key={course.enrollmentId} className="rounded-lg border p-4 hover:shadow-md transition-shadow">
                <div className="h-24 rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mb-3">
                  <Play className="w-8 h-8 text-primary/50" />
                </div>
                <h3 className="font-medium text-foreground text-sm">{course.courseTitle}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Module {course.completedModules} of {course.totalModules}
                </p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-foreground">{course.progressPct}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${course.progressPct}%` }} />
                  </div>
                </div>
                {course.deadline && (
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Due: {new Date(course.deadline).toLocaleDateString()}</span>
                  </div>
                )}
                <Link
                  href={`/employee/my-courses/${course.enrollmentId}`}
                  className="block w-full mt-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-center"
                >
                  Continue
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">Upcoming Deadlines</h2>
        {s.upcomingDeadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
        ) : (
          <div className="space-y-3">
            {s.upcomingDeadlines.map((d) => (
              <div key={d.enrollmentId} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{d.courseTitle}</p>
                  <p className="text-xs text-muted-foreground">Progress: {d.progressPct}%</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isUrgent(d.deadline) ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  {new Date(d.deadline).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
