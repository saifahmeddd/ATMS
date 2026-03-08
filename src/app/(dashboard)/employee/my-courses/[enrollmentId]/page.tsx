"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  PlayCircle, FileText, Award, CheckCircle2, ChevronLeft,
  ChevronRight, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

import type ReactPlayerType from "react-player";
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false }) as unknown as typeof ReactPlayerType;

interface ModuleProgress {
  moduleId: string;
  title: string;
  type: string;
  sequence: number;
  videoProgress: number;
  lastPosition: number;
  completed: boolean;
  hasQuiz: boolean;
  quizId: string | null;
  quizPassed: boolean | null;
  contentUrl?: string;
}

interface ProgressData {
  enrollmentId: string;
  status: string;
  progressPct: number;
  modules: ModuleProgress[];
  courseTitle?: string;
}

export default function CoursePlayerPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const [data, setData] = useState<ProgressData | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const playerRef = useRef<{ getCurrentTime: () => number } | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProgress = useCallback(async () => {
    const res = await fetch(`/api/employee/progress?enrollmentId=${enrollmentId}`);
    if (!res.ok) return;
    const prog = await res.json();

    const enrollRes = await fetch(`/api/enrollments?limit=1`);
    const enrollData = await enrollRes.json();
    const thisEnrollment = enrollData.enrollments?.find((e: { id: string }) => e.id === enrollmentId);

    const detailRes = await fetch(`/api/employee/catalogue/${thisEnrollment?.course?.id ?? ""}`);
    let courseModules: { id: string; contentUrl: string }[] = [];
    if (detailRes.ok) {
      const detail = await detailRes.json();
      courseModules = detail.modules ?? [];
      prog.courseTitle = detail.title;
    }

    const contentMap = new Map(courseModules.map((m: { id: string; contentUrl: string }) => [m.id, m.contentUrl]));
    prog.modules = prog.modules.map((m: ModuleProgress) => ({
      ...m,
      contentUrl: contentMap.get(m.moduleId) ?? "",
    }));

    setData(prog);
    setLoading(false);

    const firstIncomplete = prog.modules.findIndex((m: ModuleProgress) => !m.completed);
    if (firstIncomplete >= 0) setActiveIdx(firstIncomplete);
  }, [enrollmentId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const saveProgress = useCallback(async (videoProgress?: number, lastPosition?: number, completed?: boolean) => {
    if (!data) return;
    const mod = data.modules[activeIdx];
    await fetch("/api/employee/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId,
        moduleId: mod.moduleId,
        videoProgress,
        lastPosition,
        completed,
      }),
    });
  }, [data, activeIdx, enrollmentId]);

  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    if (!data) return;
    const mod = data.modules[activeIdx];
    if (mod.type === "VIDEO") {
      autoSaveRef.current = setInterval(() => {
        if (playerRef.current) {
          const seconds = Math.floor(playerRef.current.getCurrentTime());
          saveProgress(undefined, seconds);
        }
      }, 10000);
    }
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [data, activeIdx, saveProgress]);

  const handleMarkComplete = async () => {
    setMarking(true);
    await saveProgress(100, undefined, true);
    await fetchProgress();
    setMarking(false);
  };

  const handleVideoProgress = (state: { played: number }) => {
    const pct = Math.round(state.played * 100);
    if (pct >= 95 && data && !data.modules[activeIdx].completed) {
      handleMarkComplete();
    }
  };

  const isUnlocked = (idx: number): boolean => {
    if (idx === 0) return true;
    if (!data) return false;
    const prev = data.modules[idx - 1];
    if (!prev.completed) return false;
    if (prev.hasQuiz && !prev.quizPassed) return false;
    return true;
  };

  if (loading || !data) {
    return <div className="space-y-4"><div className="bg-card rounded-lg border h-[600px] animate-pulse" /></div>;
  }

  const current = data.modules[activeIdx];
  const completedCount = data.modules.filter((m) => m.completed).length;
  const progress = data.progressPct;

  const typeIcon = (type: string) => {
    if (type === "VIDEO") return <PlayCircle className="w-4 h-4" />;
    if (type === "PDF" || type === "DOCUMENT") return <FileText className="w-4 h-4" />;
    return <Award className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/employee/my-courses">
            <Button variant="ghost" size="sm"><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground">{data.courseTitle ?? "Course"}</h1>
            <p className="text-xs text-muted-foreground">{completedCount}/{data.modules.length} modules completed - {progress}%</p>
          </div>
        </div>
        <Progress value={progress} className="w-40 h-2" />
      </div>

      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* Sidebar */}
        <div className="w-72 shrink-0 bg-card rounded-lg border flex flex-col">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold text-foreground">Course Modules</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {data.modules.map((m, idx) => {
                const unlocked = isUnlocked(idx);
                return (
                  <button
                    key={m.moduleId}
                    onClick={() => unlocked && setActiveIdx(idx)}
                    disabled={!unlocked}
                    className={`w-full text-left p-3 flex items-start gap-3 transition-colors hover:bg-secondary/50 ${
                      activeIdx === idx ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    } ${!unlocked ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5 ${
                      m.completed ? "bg-success/15 text-success" : activeIdx === idx ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                    }`}>
                      {!unlocked ? <Lock className="w-3 h-3" /> : m.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-medium leading-tight ${activeIdx === idx ? "text-primary" : "text-foreground"}`}>{m.title}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        {typeIcon(m.type)} {m.type}
                        {m.hasQuiz && <span className="text-accent ml-1">+ Quiz</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-card rounded-lg border overflow-hidden">
          {current.type === "VIDEO" ? (
            <div className="flex-1 bg-gradient-to-br from-muted to-secondary relative">
              <ReactPlayer
                ref={(p: unknown) => { playerRef.current = p as { getCurrentTime: () => number } | null; }}
                url={(current as ModuleProgress & { contentUrl?: string }).contentUrl || ""}
                width="100%"
                height="100%"
                controls
                onProgress={handleVideoProgress}
                config={{
                  youtube: { playerVars: { start: current.lastPosition } },
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-secondary/30">
              <div className="text-center space-y-3">
                <FileText className="w-16 h-16 text-warning/50 mx-auto" />
                <p className="text-lg font-semibold text-foreground">{current.title}</p>
                <p className="text-sm text-muted-foreground">{current.type} content</p>
                {(current as ModuleProgress & { contentUrl?: string }).contentUrl && (
                  <a
                    href={(current as ModuleProgress & { contentUrl?: string }).contentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline"><FileText className="w-4 h-4 mr-1" /> Open {current.type}</Button>
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="p-4 border-t flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{current.title}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                {typeIcon(current.type)} <span>{current.type}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={activeIdx === 0} onClick={() => setActiveIdx((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              {!current.completed ? (
                current.type !== "VIDEO" ? (
                  <Button size="sm" onClick={handleMarkComplete} disabled={marking}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> {marking ? "Saving..." : "Mark Complete"}
                  </Button>
                ) : null
              ) : (
                <span className="text-xs text-success flex items-center gap-1 px-3"><CheckCircle2 className="w-4 h-4" /> Completed</span>
              )}
              {current.hasQuiz && current.completed && !current.quizPassed && (
                <Link href={`/employee/my-courses/${enrollmentId}/quiz/${current.quizId}`}>
                  <Button size="sm" variant="default"><Award className="w-4 h-4 mr-1" /> Take Quiz</Button>
                </Link>
              )}
              {current.hasQuiz && current.quizPassed && (
                <span className="text-xs text-success flex items-center gap-1 px-2"><Award className="w-4 h-4" /> Quiz Passed</span>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={activeIdx === data.modules.length - 1 || !isUnlocked(activeIdx + 1)}
                onClick={() => setActiveIdx((p) => p + 1)}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
