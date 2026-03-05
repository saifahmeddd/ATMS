"use client";

import { useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";

interface TeamOverview {
  totalMembers: number;
  totalEnrollments: number;
  completions: number;
  avgProgress: number;
}

interface MemberStat {
  id: string;
  name: string;
  enrollments: number;
  completed: number;
  avgScore: number;
  avgProgress: number;
}

interface ReportData {
  teamOverview: TeamOverview;
  memberBreakdown: MemberStat[];
  courseBreakdown: {
    id: string;
    title: string;
    enrolled: number;
    completed: number;
    avgScore: number;
  }[];
}

function getPerformanceLabel(score: number) {
  if (score >= 85) return { label: "Excellent", className: "bg-success/10 text-success" };
  if (score >= 70) return { label: "Good", className: "bg-info/10 text-info" };
  return { label: "Needs Improvement", className: "bg-warning/10 text-warning" };
}

export default function ManagerReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/manager/reports?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Member", "Courses", "Completed", "Avg. Score", "Avg. Progress", "Performance"],
      ...data.memberBreakdown.map((m) => [
        m.name,
        String(m.enrollments),
        String(m.completed),
        `${m.avgScore}%`,
        `${m.avgProgress}%`,
        getPerformanceLabel(m.avgScore).label,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const overview = data?.teamOverview ?? {
    totalMembers: 0,
    totalEnrollments: 0,
    completions: 0,
    avgProgress: 0,
  };

  const allScores = data?.memberBreakdown.map((m) => m.avgScore) ?? [];
  const teamAvgScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Team Reports</h1>
          <p className="page-subheader">
            Analyze your team&apos;s training performance
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!data}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Team Avg. Score</p>
          <p className="text-2xl font-bold text-foreground mt-1">{teamAvgScore}%</p>
          <div className="h-2 bg-secondary rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-success rounded-full"
              style={{ width: `${teamAvgScore}%` }}
            />
          </div>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Courses Completed</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {overview.completions}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            of {overview.totalEnrollments} total enrollments
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Avg. Progress</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {overview.avgProgress}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {overview.totalMembers} team members
          </p>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">
          Individual Performance
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Loading...
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-3 font-medium">Member</th>
                <th className="text-left py-3 font-medium">Courses</th>
                <th className="text-left py-3 font-medium">Completed</th>
                <th className="text-left py-3 font-medium">Avg. Score</th>
                <th className="text-left py-3 font-medium">Progress</th>
                <th className="text-left py-3 font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {data?.memberBreakdown.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                data?.memberBreakdown.map((m) => {
                  const perf = getPerformanceLabel(m.avgScore);
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-3 font-medium text-foreground">
                        {m.name}
                      </td>
                      <td className="py-3 text-foreground">{m.enrollments}</td>
                      <td className="py-3 text-foreground">{m.completed}</td>
                      <td className="py-3 text-foreground">{m.avgScore}%</td>
                      <td className="py-3 text-foreground">{m.avgProgress}%</td>
                      <td className="py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${perf.className}`}
                        >
                          {perf.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
