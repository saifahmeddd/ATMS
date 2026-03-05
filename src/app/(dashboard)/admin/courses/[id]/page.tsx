"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, BookOpen, HelpCircle, Clock, Target, RotateCcw } from "lucide-react";

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
}

interface Quiz {
  id: string;
  passingScore: number;
  durationMinutes: number;
  maxAttempts: number;
  questions: Question[];
}

interface Module {
  id: string;
  title: string;
  type: string;
  contentUrl: string;
  sequence: number;
  quiz: Quiz | null;
}

interface Prerequisite {
  prerequisiteCourse: { id: string; title: string; status: string };
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: string;
  category: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  modules: Module[];
  prerequisites: Prerequisite[];
  _count: { enrollments: number };
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/${id}`)
      .then((r) => r.json())
      .then(setCourse)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  if (!course) return <div className="text-center py-20 text-muted-foreground">Course not found</div>;

  const statusColor =
    course.status === "PUBLISHED" ? "bg-success/10 text-success" :
    course.status === "DRAFT" ? "bg-warning/10 text-warning" :
    "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/courses")} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="page-header">{course.title}</h1>
            <p className="page-subheader">Created by {course.createdBy.name} on {new Date(course.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/admin/courses/${id}/edit`)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Edit className="w-4 h-4" />
          Edit Course
        </button>
      </div>

      {/* Overview */}
      <div className="bg-card rounded-lg border p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
            {course.status === "PUBLISHED" ? "Published" : course.status === "DRAFT" ? "Draft" : "Archived"}
          </span>
          {course.category && <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">{course.category}</span>}
        </div>
        {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground">{course.modules.length} modules</span>
          <span className="text-muted-foreground">{course._count.enrollments} enrolled</span>
          <span className="text-muted-foreground">{course.prerequisites.length} prerequisites</span>
        </div>
      </div>

      {/* Prerequisites */}
      {course.prerequisites.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold text-foreground mb-3">Prerequisites</h2>
          <div className="flex flex-wrap gap-2">
            {course.prerequisites.map((p) => (
              <span key={p.prerequisiteCourse.id} className="text-sm bg-secondary px-3 py-1.5 rounded-lg text-foreground">
                {p.prerequisiteCourse.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Modules ({course.modules.length})</h2>
        {course.modules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No modules added yet</p>
        ) : (
          <div className="space-y-3">
            {course.modules.map((mod, i) => (
              <div key={mod.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">{i + 1}</span>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{mod.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {mod.type} — <a href={mod.contentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[200px] inline-block">{mod.contentUrl}</a>
                      </p>
                    </div>
                  </div>
                </div>
                {mod.quiz && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1"><HelpCircle className="w-3 h-3" />{mod.quiz.questions.length} questions</span>
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" />{mod.quiz.passingScore}% to pass</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{mod.quiz.durationMinutes} min</span>
                      <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3" />{mod.quiz.maxAttempts} attempts</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
