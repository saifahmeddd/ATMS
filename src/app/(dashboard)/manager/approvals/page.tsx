"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

interface EnrollmentRequest {
  id: string;
  status: string;
  enrolledAt: string;
  comment: string | null;
  user: { id: string; name: string; email: string };
  course: { id: string; title: string };
  approvedBy: { id: string; name: string } | null;
}

type Tab = "pending" | "processed";

export default function ManagerApprovalsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<EnrollmentRequest[]>([]);
  const [processed, setProcessed] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchEnrollments = useCallback(async () => {
    setError(null);
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch("/api/enrollments?status=PENDING&limit=50"),
        fetch("/api/enrollments?status=APPROVED&limit=20"),
        fetch("/api/enrollments?status=REJECTED&limit=20"),
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPending(data.enrollments ?? []);
      }

      const processedItems: EnrollmentRequest[] = [];
      if (approvedRes.ok) {
        const data = await approvedRes.json();
        processedItems.push(...(data.enrollments ?? []));
      }
      if (rejectedRes.ok) {
        const data = await rejectedRes.json();
        processedItems.push(...(data.enrollments ?? []));
      }
      processedItems.sort(
        (a, b) =>
          new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
      );
      setProcessed(processedItems);
    } catch {
      setError("Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  async function handleAction(
    enrollmentId: string,
    status: "APPROVED" | "REJECTED"
  ) {
    setActionLoading(enrollmentId);
    setError(null);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          comment: commentFor === enrollmentId ? commentText || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommentFor(null);
        setCommentText("");
        await fetchEnrollments();
      } else {
        setError(data.error ?? "Failed to update enrollment");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setActionLoading(null);
    }
  }

  const activeList = tab === "pending" ? pending : processed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Approval Requests</h1>
        <p className="page-subheader">
          Review and approve or reject training enrollment requests from your team
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "pending"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab("processed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "processed"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
        >
          Processed ({processed.length})
        </button>
      </div>

      <div className="bg-card rounded-lg border divide-y">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : activeList.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {tab === "pending"
              ? "No pending enrollment requests"
              : "No processed requests yet"}
          </div>
        ) : (
          activeList.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
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
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(r.enrolledAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                {r.status === "PENDING" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCommentFor(commentFor === r.id ? null : r.id);
                        setCommentText("");
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border hover:bg-secondary"
                      title="Add comment"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      size="sm"
                      disabled={actionLoading === r.id}
                      onClick={() => handleAction(r.id, "APPROVED")}
                      className="bg-success hover:bg-success/90 text-success-foreground"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionLoading === r.id}
                      onClick={() => handleAction(r.id, "REJECTED")}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "APPROVED"
                        ? "bg-success/10 text-success"
                        : r.status === "REJECTED"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-info/10 text-info"
                    }`}
                  >
                    {r.status}
                  </span>
                )}
              </div>
              {commentFor === r.id && (
                <div className="mt-3 ml-14">
                  <input
                    type="text"
                    placeholder="Add a comment (optional)..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
              {r.comment && (
                <p className="mt-2 ml-14 text-xs text-muted-foreground italic">
                  Comment: {r.comment}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
