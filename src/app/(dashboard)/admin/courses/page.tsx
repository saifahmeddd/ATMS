"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Edit, Trash2, Eye, Copy } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: string;
  category: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  _count: { modules: number; enrollments: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CourseManagementPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", "20");
      if (statusFilter !== "All") params.set("status", statusFilter.toUpperCase());
      if (searchDebounced) params.set("search", searchDebounced);

      const res = await fetch(`/api/courses?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses ?? []);
        if (data.pagination) setPagination(data.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter, searchDebounced]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search);
      setPagination((p) => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function handleDelete() {
    if (!deleteCourse) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/courses/${deleteCourse.id}`, { method: "DELETE" });
      setDeleteCourse(null);
      fetchCourses();
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDuplicate(courseId: string) {
    setDuplicating(courseId);
    try {
      const res = await fetch(`/api/courses/${courseId}/duplicate`, { method: "POST" });
      if (res.ok) fetchCourses();
    } finally {
      setDuplicating(null);
    }
  }

  const statusLabel = (s: string) => {
    if (s === "PUBLISHED") return "Published";
    if (s === "DRAFT") return "Draft";
    return "Archived";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Course Management</h1>
          <p className="page-subheader">Create and manage training courses</p>
        </div>
        <button
          onClick={() => router.push("/admin/courses/new")}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Course
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2">
          {["All", "Published", "Draft", "Archived"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border text-foreground hover:bg-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading courses...</div>
      ) : courses.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No courses found</p>
          <button
            onClick={() => router.push("/admin/courses/new")}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Create your first course
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div key={course.id} className="bg-card rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-32 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary/30">
                    {(course.category ?? "NA").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        course.status === "PUBLISHED"
                          ? "bg-success/10 text-success"
                          : course.status === "DRAFT"
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {statusLabel(course.status)}
                    </span>
                    <span className="text-xs text-muted-foreground">{course.category ?? "—"}</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{course.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span>{course._count.modules} modules</span>
                    <span>{course._count.enrollments} enrolled</span>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <button
                      onClick={() => router.push(`/admin/courses/${course.id}`)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => router.push(`/admin/courses/${course.id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(course.id)}
                      disabled={duplicating === course.id}
                      className="p-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-50"
                      title="Duplicate"
                    >
                      <Copy className={`w-3.5 h-3.5 text-muted-foreground ${duplicating === course.id ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={() => setDeleteCourse(course)}
                      className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-sm rounded border bg-card hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-sm rounded border bg-card hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <DeleteDialog
        open={!!deleteCourse}
        onClose={() => setDeleteCourse(null)}
        onConfirm={handleDelete}
        title="Delete Course"
        description="This will permanently delete this course and all its modules, quizzes, and questions."
        itemName={deleteCourse?.title ?? ""}
        loading={deleteLoading}
      />
    </div>
  );
}
