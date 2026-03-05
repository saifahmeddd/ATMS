"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Users, BookOpen, Award, ChevronDown } from "lucide-react";

interface ReportData {
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  avgQuizScore: number;
  monthlyEnrollments: { month: number; count: number }[];
  categoryDistribution: { category: string; count: number; percentage: number }[];
}

interface QuizAnalytics {
  quizId: string;
  moduleTitle: string;
  courseTitle: string;
  passingScore: number;
  totalAttempts: number;
  avgScore: number;
  passRate: number;
  questionStats: { questionText: string; correctRate: number; difficulty: string }[];
}

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [quizAnalytics, setQuizAnalytics] = useState<QuizAnalytics[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/reports").then((r) => r.json()),
      fetch("/api/admin/quiz-analytics").then((r) => r.json()),
    ])
      .then(([reports, analytics]) => {
        setData(reports);
        setQuizAnalytics(analytics.quizzes ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Enrollments", String(data.totalEnrollments)],
      ["Completed Enrollments", String(data.completedEnrollments)],
      ["Completion Rate (%)", String(data.completionRate)],
      ["Avg Quiz Score (%)", String(data.avgQuizScore)],
      [],
      ["Month", "Enrollments"],
      ...data.monthlyEnrollments.map((m) => [MONTH_LABELS[m.month - 1], String(m.count)]),
      [],
      ["Category", "Count", "Percentage (%)"],
      ...data.categoryDistribution.map((c) => [c.category, String(c.count), String(c.percentage)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportPDF = async () => {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("TMS Admin Report", 14, 20);
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.setFontSize(12);
    let y = 40;
    doc.text(`Total Enrollments: ${data.totalEnrollments}`, 14, y);
    y += 7;
    doc.text(`Completed: ${data.completedEnrollments}`, 14, y);
    y += 7;
    doc.text(`Completion Rate: ${data.completionRate}%`, 14, y);
    y += 7;
    doc.text(`Avg Quiz Score: ${data.avgQuizScore}%`, 14, y);
    y += 15;
    doc.text("Monthly Enrollments:", 14, y);
    y += 7;
    data.monthlyEnrollments.forEach((m, i) => {
      doc.text(`${MONTH_LABELS[i]}: ${m.count}`, 20, y);
      y += 6;
    });
    y += 10;
    doc.text("Category Distribution:", 14, y);
    y += 7;
    data.categoryDistribution.forEach((c) => {
      doc.text(`${c.category}: ${c.count} (${c.percentage}%)`, 20, y);
      y += 6;
    });
    doc.save(`admin-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    setExportOpen(false);
  };

  const exportExcel = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Enrollments", String(data.totalEnrollments)],
      ["Completed Enrollments", String(data.completedEnrollments)],
      ["Completion Rate (%)", String(data.completionRate)],
      ["Avg Quiz Score (%)", String(data.avgQuizScore)],
      [],
      ["Month", "Enrollments"],
      ...data.monthlyEnrollments.map((m) => [MONTH_LABELS[m.month - 1], String(m.count)]),
      [],
      ["Category", "Count", "Percentage (%)"],
      ...data.categoryDistribution.map((c) => [c.category, String(c.count), String(c.percentage)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading reports...</div>;
  }

  const d = data ?? {
    totalEnrollments: 0,
    completedEnrollments: 0,
    completionRate: 0,
    avgQuizScore: 0,
    monthlyEnrollments: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 })),
    categoryDistribution: [],
  };

  const maxMonthly = Math.max(...d.monthlyEnrollments.map((m) => m.count), 1);
  const activeRate = d.totalEnrollments > 0 ? Math.round(((d.totalEnrollments - d.completedEnrollments) / d.totalEnrollments) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Reports & Analytics</h1>
          <p className="page-subheader">System-wide training analytics and reporting</p>
        </div>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Report
            <ChevronDown className="w-4 h-4" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 py-1 bg-card border rounded-lg shadow-lg z-10 min-w-[140px]">
              <button
                onClick={exportPDF}
                disabled={!data}
                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Export as PDF
              </button>
              <button
                onClick={exportCSV}
                disabled={!data}
                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Export as CSV
              </button>
              <button
                onClick={exportExcel}
                disabled={!data}
                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Export for Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Enrollments</p>
              <p className="text-xl font-bold text-foreground">{d.totalEnrollments.toLocaleString()}</p>
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${activeRate}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{activeRate}% active enrollment rate</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Course Completions</p>
              <p className="text-xl font-bold text-foreground">{d.completedEnrollments.toLocaleString()}</p>
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full" style={{ width: `${d.completionRate}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{d.completionRate}% completion rate</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Quiz Score</p>
              <p className="text-xl font-bold text-foreground">{d.avgQuizScore}%</p>
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-info rounded-full" style={{ width: `${d.avgQuizScore}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{d.avgQuizScore >= 80 ? "Above" : "Below"} 80% passing threshold</p>
        </div>
      </div>

      {/* Monthly Enrollment Trend */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">Monthly Enrollment Trend</h2>
        <div className="grid grid-cols-12 gap-2 h-40 items-end">
          {d.monthlyEnrollments.map((m, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors min-h-[2px]"
                style={{ height: `${(m.count / maxMonthly) * 100}%` }}
                title={`${m.count} enrollments`}
              />
              <span className="text-[10px] text-muted-foreground">{MONTH_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Distribution */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">Course Category Distribution</h2>
        {d.categoryDistribution.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No course data available</p>
        ) : (
          <div className="space-y-3">
            {d.categoryDistribution.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <span className="text-sm text-foreground">{c.category}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{c.count} courses</span>
                  <span className="text-sm font-semibold text-foreground">{c.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quiz Analytics (FR-8.6) */}
      {quizAnalytics && quizAnalytics.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold text-foreground mb-4">Quiz Analytics</h2>
          <div className="space-y-4">
            {quizAnalytics.map((q) => (
              <div key={q.quizId} className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">{q.moduleTitle}</span>
                  <span className="text-xs text-muted-foreground">{q.courseTitle}</span>
                </div>
                <div className="flex gap-4 text-sm mb-2">
                  <span>Avg Score: <strong>{q.avgScore}%</strong></span>
                  <span>Pass Rate: <strong>{q.passRate}%</strong></span>
                  <span>Attempts: <strong>{q.totalAttempts}</strong></span>
                </div>
                {q.questionStats.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Question complexity:</p>
                    <div className="flex flex-wrap gap-2">
                      {q.questionStats.map((qs, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded ${
                            qs.difficulty === "Easy" ? "bg-success/20 text-success" :
                            qs.difficulty === "Medium" ? "bg-warning/20 text-warning" :
                            "bg-destructive/20 text-destructive"
                          }`}
                          title={qs.questionText}
                        >
                          Q{i + 1}: {qs.correctRate}% ({qs.difficulty})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
