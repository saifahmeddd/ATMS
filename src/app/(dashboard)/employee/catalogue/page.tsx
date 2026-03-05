"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, Clock, Users } from "lucide-react";

interface CatalogCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  moduleCount: number;
  enrolledCount: number;
  prereqsMet: boolean;
  enrollment: { id: string; status: string } | null;
}

export default function CourseCataloguePage() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const fetchCourses = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter !== "All") params.set("category", categoryFilter);
    params.set("limit", "50");
    const res = await fetch(`/api/employee/catalogue?${params}`);
    const data = await res.json();
    setCourses(data.courses);
    setCategories(data.categories ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCourses();
  }, [search, categoryFilter]);

  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId);
    const res = await fetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "self", courseId }),
    });
    if (res.ok) {
      await fetchCourses();
    }
    setEnrolling(null);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      PENDING: { label: "Pending Approval", cls: "bg-warning/10 text-warning" },
      APPROVED: { label: "Approved", cls: "bg-success/10 text-success" },
      IN_PROGRESS: { label: "In Progress", cls: "bg-info/10 text-info" },
      COMPLETED: { label: "Completed", cls: "bg-success/10 text-success" },
      CANCELLED: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
    };
    return map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Course Catalogue</h1>
        <p className="page-subheader">Browse and enroll in available training courses</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-card border text-foreground hover:bg-secondary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-lg border h-72 animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No courses found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const st = course.enrollment ? statusLabel(course.enrollment.status) : null;
            return (
              <div key={course.id} className="bg-card rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
                <Link href={`/employee/catalogue/${course.id}`}>
                  <div className="h-36 bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center relative">
                    <BookOpen className="w-10 h-10 text-primary/30" />
                    {course.category && (
                      <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-card/90 text-foreground">{course.category}</span>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/employee/catalogue/${course.id}`}>
                    <h3 className="font-semibold text-foreground mb-1 hover:text-primary transition-colors">{course.title}</h3>
                  </Link>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.moduleCount} modules</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.enrolledCount} enrolled</span>
                  </div>
                  {!course.prereqsMet && !course.enrollment && (
                    <p className="text-xs text-warning mb-2">Prerequisites not met</p>
                  )}
                  {course.enrollment ? (
                    <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${st!.cls}`}>{st!.label}</span>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      disabled={!course.prereqsMet || enrolling === course.id}
                      className="w-full py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {enrolling === course.id ? "Enrolling..." : "Request Enrollment"}
                    </button>
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
