"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, Users, CheckCircle2, PlayCircle,
  FileText, Award, ChevronRight, ArrowLeft, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CourseModule {
  id: string;
  title: string;
  type: string;
  sequence: number;
  completed: boolean;
  hasQuiz: boolean;
  quizId: string | null;
  quizPassed: boolean | null;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  createdAt: string;
  createdBy: string;
  moduleCount: number;
  enrolledCount: number;
  modules: CourseModule[];
  prerequisites: { courseId: string; title: string; met: boolean }[];
  prereqsMet: boolean;
  enrollment: {
    id: string;
    status: string;
    progressPct: number;
    deadline: string | null;
    enrolledAt: string;
  } | null;
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  const fetchCourse = useCallback(async () => {
    const res = await fetch(`/api/employee/catalogue/${courseId}`);
    if (res.ok) setCourse(await res.json());
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const handleEnroll = async () => {
    setEnrolling(true);
    const res = await fetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "self", courseId }),
    });
    if (res.ok) await fetchCourse();
    setEnrolling(false);
  };

  const handleCancel = async () => {
    if (!course?.enrollment) return;
    await fetch(`/api/enrollments/${course.enrollment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    await fetchCourse();
  };

  if (loading) {
    return <div className="space-y-6"><div className="bg-card rounded-xl border h-96 animate-pulse" /></div>;
  }

  if (!course) {
    return (
      <div className="space-y-6 text-center py-20">
        <p className="text-muted-foreground">Course not found.</p>
        <Link href="/employee/catalogue"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Catalogue</Button></Link>
      </div>
    );
  }

  const progress = course.enrollment?.progressPct ?? 0;
  const isEnrolled = !!course.enrollment;
  const isActive = course.enrollment && ["APPROVED", "IN_PROGRESS"].includes(course.enrollment.status);

  const typeIcon = (type: string) => {
    if (type === "VIDEO") return <PlayCircle className="w-4 h-4 text-primary" />;
    if (type === "PDF") return <FileText className="w-4 h-4 text-warning" />;
    return <FileText className="w-4 h-4 text-accent" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/employee/catalogue" className="hover:text-primary transition-colors">Course Catalogue</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">{course.title}</span>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="h-44 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/15 flex items-center justify-center relative">
          <BookOpen className="w-16 h-16 text-primary/25" />
          {course.category && (
            <span className="absolute top-4 left-4 text-xs px-3 py-1 rounded-full bg-card/90 text-foreground font-medium">{course.category}</span>
          )}
        </div>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">{course.title}</h1>
          <p className="text-muted-foreground mb-4">{course.description}</p>

          <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground mb-6">
            <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" />{course.moduleCount} Modules</span>
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{course.enrolledCount} Enrolled</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />Created {new Date(course.createdAt).toLocaleDateString()}</span>
            <span className="flex items-center gap-1.5">By {course.createdBy}</span>
          </div>

          <div className="flex items-center gap-3">
            {isActive ? (
              <Button asChild>
                <Link href={`/employee/my-courses/${course.enrollment!.id}`}>
                  <PlayCircle className="w-4 h-4 mr-1" /> Continue Learning
                </Link>
              </Button>
            ) : course.enrollment?.status === "PENDING" ? (
              <Button variant="outline" onClick={handleCancel}>Cancel Request</Button>
            ) : course.enrollment?.status === "COMPLETED" ? (
              <Button variant="outline" asChild>
                <Link href="/employee/certificates"><Award className="w-4 h-4 mr-1" /> View Certificate</Link>
              </Button>
            ) : !isEnrolled ? (
              <Button onClick={handleEnroll} disabled={!course.prereqsMet || enrolling}>
                {enrolling ? "Enrolling..." : "Request Enrollment"}
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/employee/catalogue"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Catalogue</Link>
            </Button>
          </div>

          {isEnrolled && course.enrollment!.status !== "PENDING" && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {!course.prereqsMet && !isEnrolled && (
            <p className="mt-3 text-sm text-warning">Prerequisites not met. Complete the required courses first.</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="info">Course Info</TabsTrigger>
        </TabsList>

        <TabsContent value="modules">
          <div className="bg-card rounded-lg border divide-y">
            {course.modules.map((m, idx) => (
              <div key={m.id} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  m.completed ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                }`}>
                  {m.completed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{m.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    {typeIcon(m.type)}
                    <span>{m.type}</span>
                    {m.hasQuiz && <span className="text-accent">+ Quiz</span>}
                  </p>
                </div>
                {isActive && (
                  <Link href={`/employee/my-courses/${course.enrollment!.id}`}>
                    <Button size="sm" variant={m.completed ? "outline" : "default"}>
                      {m.completed ? "Review" : "Start"}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="info">
          <div className="bg-card rounded-lg border p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Instructor</p>
              <p className="text-sm font-medium text-foreground">{course.createdBy}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Modules</p>
              <p className="text-sm font-medium text-foreground">{course.moduleCount} modules</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enrolled Students</p>
              <p className="text-sm font-medium text-foreground">{course.enrolledCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium text-foreground">{new Date(course.createdAt).toLocaleDateString()}</p>
            </div>
            {course.prerequisites.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Prerequisites</p>
                <div className="flex gap-2 flex-wrap">
                  {course.prerequisites.map((p) => (
                    <span key={p.courseId} className={`text-xs px-2.5 py-1 rounded-full ${p.met ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                      {p.title} {p.met ? "(Completed)" : "(Required)"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
