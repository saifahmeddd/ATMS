"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown, ArrowLeft, Save, Send } from "lucide-react";
import QuizBuilder, { type QuizData } from "./QuizBuilder";

interface ModuleData {
  id?: string;
  title: string;
  type: "VIDEO" | "PDF" | "DOCUMENT";
  contentUrl: string;
  sequence: number;
  quiz: QuizData | null;
}

interface PrereqOption {
  id: string;
  title: string;
}

interface CourseFormProps {
  courseId?: string;
}

export default function CourseForm({ courseId }: CourseFormProps) {
  const router = useRouter();
  const isEdit = !!courseId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);
  const [prereqOptions, setPrereqOptions] = useState<PrereqOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/courses?limit=100&status=PUBLISHED")
      .then((r) => r.json())
      .then((d) => {
        const options = (d.courses ?? [])
          .filter((c: { id: string }) => c.id !== courseId)
          .map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }));
        setPrereqOptions(options);
      })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setCategory(data.category ?? "");
        setThumbnailUrl(data.thumbnailUrl ?? "");
        setStatus(data.status ?? "DRAFT");
        setSelectedPrereqs(
          (data.prerequisites ?? []).map((p: { prerequisiteCourseId: string }) => p.prerequisiteCourseId)
        );
        setModules(
          (data.modules ?? []).map((m: {
            id: string;
            title: string;
            type: "VIDEO" | "PDF" | "DOCUMENT";
            contentUrl: string;
            sequence: number;
            quiz: QuizData | null;
          }) => ({
            id: m.id,
            title: m.title,
            type: m.type,
            contentUrl: m.contentUrl,
            sequence: m.sequence,
            quiz: m.quiz
              ? {
                  id: m.quiz.id,
                  passingScore: m.quiz.passingScore,
                  durationMinutes: m.quiz.durationMinutes,
                  maxAttempts: m.quiz.maxAttempts,
                  questions: (m.quiz as QuizData).questions ?? [],
                }
              : null,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  function addModule() {
    setModules((prev) => [
      ...prev,
      { title: "", type: "VIDEO", contentUrl: "", sequence: prev.length, quiz: null },
    ]);
  }

  function removeModule(idx: number) {
    setModules((prev) => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, sequence: i })));
  }

  function moveModule(idx: number, dir: -1 | 1) {
    setModules((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((m, i) => ({ ...m, sequence: i }));
    });
  }

  function updateModule(idx: number, partial: Partial<ModuleData>) {
    setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, ...partial } : m)));
  }

  async function handleSave(saveStatus?: "DRAFT" | "PUBLISHED") {
    setError("");
    const finalStatus = saveStatus ?? status;

    if (!title.trim()) {
      setError("Course title is required");
      return;
    }

    setSaving(true);
    try {
      let savedCourseId = courseId;

      if (isEdit) {
        const res = await fetch(`/api/courses/${courseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: description || null, category: category || null, thumbnailUrl: thumbnailUrl || null, status: finalStatus }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Failed to update course");
        }
      } else {
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: description || null, category: category || null, thumbnailUrl: thumbnailUrl || null, status: finalStatus }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Failed to create course");
        }
        const data = await res.json();
        savedCourseId = data.id;
      }

      if (!savedCourseId) throw new Error("No course ID");

      // Sync prerequisites
      await fetch(`/api/courses/${savedCourseId}/prerequisites`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prerequisiteIds: selectedPrereqs }),
      });

      // Sync modules
      if (isEdit) {
        const existingRes = await fetch(`/api/courses/${savedCourseId}/modules`);
        const existing: { id: string }[] = await existingRes.json();
        const existingIds = existing.map((m) => m.id);
        const currentIds = modules.filter((m) => m.id).map((m) => m.id!);

        for (const eid of existingIds) {
          if (!currentIds.includes(eid)) {
            await fetch(`/api/courses/${savedCourseId}/modules/${eid}`, { method: "DELETE" });
          }
        }
      }

      for (const mod of modules) {
        let modId = mod.id;

        if (modId && isEdit) {
          await fetch(`/api/courses/${savedCourseId}/modules/${modId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: mod.title, type: mod.type, contentUrl: mod.contentUrl, sequence: mod.sequence }),
          });
        } else {
          const res = await fetch(`/api/courses/${savedCourseId}/modules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: mod.title, type: mod.type, contentUrl: mod.contentUrl, sequence: mod.sequence }),
          });
          if (res.ok) {
            const data = await res.json();
            modId = data.id;
          }
        }

        if (!modId) continue;

        // Sync quiz
        if (mod.quiz) {
          const quizRes = await fetch(`/api/modules/${modId}/quiz`);
          if (quizRes.ok) {
            await fetch(`/api/modules/${modId}/quiz`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                passingScore: mod.quiz.passingScore,
                durationMinutes: mod.quiz.durationMinutes,
                maxAttempts: mod.quiz.maxAttempts,
              }),
            });
          } else {
            await fetch(`/api/modules/${modId}/quiz`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                passingScore: mod.quiz.passingScore,
                durationMinutes: mod.quiz.durationMinutes,
                maxAttempts: mod.quiz.maxAttempts,
              }),
            });
          }

          const quizData = await (await fetch(`/api/modules/${modId}/quiz`)).json();
          const quizId = quizData.id;

          if (quizId) {
            const existingQs: { id: string }[] = quizData.questions ?? [];
            const existingQIds = existingQs.map((q) => q.id);
            const currentQIds = mod.quiz.questions.filter((q) => q.id).map((q) => q.id!);

            for (const qid of existingQIds) {
              if (!currentQIds.includes(qid)) {
                await fetch(`/api/quizzes/${quizId}/questions/${qid}`, { method: "DELETE" });
              }
            }

            for (const q of mod.quiz.questions) {
              if (q.id && existingQIds.includes(q.id)) {
                await fetch(`/api/quizzes/${quizId}/questions/${q.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ questionText: q.questionText, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation || undefined }),
                });
              } else {
                await fetch(`/api/quizzes/${quizId}/questions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ questionText: q.questionText, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation || undefined }),
                });
              }
            }
          }
        } else {
          const quizRes = await fetch(`/api/modules/${modId}/quiz`);
          if (quizRes.ok) {
            await fetch(`/api/modules/${modId}/quiz`, { method: "DELETE" });
          }
        }
      }

      router.push("/admin/courses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/courses")} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="page-header">{isEdit ? "Edit Course" : "Create Course"}</h1>
            <p className="page-subheader">{isEdit ? "Update course details, modules, and quizzes" : "Add a new training course"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave("DRAFT")}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={() => handleSave("PUBLISHED")}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            Publish
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
      )}

      {/* Section 1: Basic Info */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm text-foreground block mb-1">Course Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Leadership Fundamentals"
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-foreground block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Course description..."
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Management, Technical"
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1">Thumbnail URL</label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1">Prerequisites</label>
            <select
              multiple
              value={selectedPrereqs}
              onChange={(e) => setSelectedPrereqs(Array.from(e.target.selectedOptions, (o) => o.value))}
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
            >
              {prereqOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
        </div>
      </div>

      {/* Section 2: Modules */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Modules</h2>
          <button
            type="button"
            onClick={addModule}
            className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Module
          </button>
        </div>

        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No modules yet. Add one to get started.</p>
        ) : (
          <div className="space-y-4">
            {modules.map((mod, i) => (
              <div key={mod.id ?? `new-${i}`} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Module {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveModule(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-secondary disabled:opacity-30 transition-colors">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveModule(i, 1)} disabled={i === modules.length - 1} className="p-1 rounded hover:bg-secondary disabled:opacity-30 transition-colors">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeModule(i)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-sm text-foreground block mb-1">Title</label>
                    <input
                      type="text"
                      value={mod.title}
                      onChange={(e) => updateModule(i, { title: e.target.value })}
                      placeholder="Module title"
                      className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-foreground block mb-1">Type</label>
                    <select
                      value={mod.type}
                      onChange={(e) => updateModule(i, { type: e.target.value as ModuleData["type"] })}
                      className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="VIDEO">Video</option>
                      <option value="PDF">PDF</option>
                      <option value="DOCUMENT">Document</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-foreground block mb-1">Content URL</label>
                  <input
                    type="text"
                    value={mod.contentUrl}
                    onChange={(e) => updateModule(i, { contentUrl: e.target.value })}
                    placeholder={mod.type === "VIDEO" ? "https://youtube.com/watch?v=..." : "https://example.com/doc.pdf"}
                    className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <QuizBuilder
                  quiz={mod.quiz}
                  onChange={(quiz) => updateModule(i, { quiz })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
