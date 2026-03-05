"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

interface TranscriptItem {
  courseId: string;
  courseTitle: string;
  category: string | null;
  completedAt: string;
  grade: number | null;
  progressPct: number;
  verificationCode: string | null;
}

export default function TranscriptPage() {
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employee/transcript")
      .then((r) => r.json())
      .then((data) => setTranscript(data.transcript ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">My Transcript</h1>
        <div className="bg-card rounded-lg border h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">My Transcript</h1>
        <p className="page-subheader">
          Record of completed courses and grades (FR-8.7)
        </p>
      </div>

      {transcript.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No completed courses yet. Complete a course to see it on your transcript.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium">Course</th>
                <th className="text-left py-3 px-4 font-medium">Category</th>
                <th className="text-left py-3 px-4 font-medium">Grade</th>
                <th className="text-left py-3 px-4 font-medium">Completed</th>
                <th className="text-left py-3 px-4 font-medium">Certificate ID</th>
              </tr>
            </thead>
            <tbody>
              {transcript.map((item) => (
                <tr key={item.courseId} className="border-b last:border-0">
                  <td className="py-3 px-4 font-medium text-foreground">
                    {item.courseTitle}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {item.category ?? "—"}
                  </td>
                  <td className="py-3 px-4">
                    {item.grade !== null ? (
                      <span className="font-medium text-foreground">{item.grade}%</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {new Date(item.completedAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">
                    {item.verificationCode ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
