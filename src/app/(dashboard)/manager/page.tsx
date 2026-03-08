"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Stats {
  teamSize: number;
  activeEnrollments: number;
  pendingApprovals: number;
  completionRate: number;
  pendingRequests: {
    id: string;
    user: { id: string; name: string };
    course: { id: string; title: string };
    enrolledAt: string;
  }[];
  teamProgress: {
    id: string;
    name: string;
    courses: number;
    progress: number;
    completed: number;
  }[];
}

export default function ManagerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/manager/stats");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleApproval(enrollmentId: string, status: "APPROVED" | "REJECTED") {
    setActionLoading(enrollmentId);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await fetchStats();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Manager Dashboard</h1>
          <p className="page-subheader">Monitor your team&apos;s training progress</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card h-24 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats ?? {
    teamSize: 0,
    activeEnrollments: 0,
    pendingApprovals: 0,
    completionRate: 0,
    pendingRequests: [],
    teamProgress: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Manager Dashboard</h1>
        <p className="page-subheader">Monitor your team&apos;s training progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Team Members</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.teamSize}</p>
            <p className="text-xs text-success mt-1">
              {s.teamSize > 0 ? "Active team" : "No members yet"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Active Courses</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {s.activeEnrollments}
            </p>
            <p className="text-xs text-muted-foreground mt-1">In progress by team</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-info" />
          </div>
        </div>
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Pending Approvals</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {s.pendingApprovals}
            </p>
            <p className="text-xs text-warning mt-1">
              {s.pendingApprovals > 0 ? "Needs attention" : "All clear"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-warning" />
          </div>
        </div>
        <div className="stat-card flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Team Completion</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {s.completionRate}%
            </p>
            <p className="text-xs text-success mt-1">Overall completion rate</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">
              Pending Approval Requests
            </h2>
            {s.pendingApprovals > 0 && (
              <Link
                href="/manager/approvals"
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          {s.pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No pending requests
            </p>
          ) : (
            <div className="space-y-3">
              {s.pendingRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {r.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {r.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.course.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={actionLoading === r.id}
                      onClick={() => handleApproval(r.id, "APPROVED")}
                      className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-success text-success-foreground hover:bg-success/90 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Approve
                    </button>
                    <button
                      disabled={actionLoading === r.id}
                      onClick={() => handleApproval(r.id, "REJECTED")}
                      className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Progress */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">
              Team Training Progress
            </h2>
            <Link
              href="/manager/team"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {s.teamProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No team members yet
            </p>
          ) : (
            <div className="space-y-3">
              {s.teamProgress.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground">{m.name}</span>
                      <span className="text-muted-foreground">{m.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          m.progress >= 80
                            ? "bg-success"
                            : m.progress >= 50
                              ? "bg-warning"
                              : "bg-destructive"
                        }`}
                        style={{ width: `${m.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
