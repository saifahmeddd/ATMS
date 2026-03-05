"use client";

import { useEffect, useState } from "react";
import { Search, CheckCircle2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface CourseOption {
  id: string;
  title: string;
  category: string | null;
  modules?: { id: string }[];
}

interface AssignResult {
  assigned: number;
  skipped: number;
}

export default function ManagerAssignPage() {
  const [step, setStep] = useState(1);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);

  useEffect(() => {
    fetch("/api/manager/team")
      .then((r) => r.json())
      .then((data) => setTeam(data.members ?? []));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (courseSearch) params.set("search", courseSearch);
    fetch(`/api/courses?status=PUBLISHED&limit=50&${params}`)
      .then((r) => r.json())
      .then((data) => setCourses(data.courses ?? []));
  }, [courseSearch]);

  function toggleUser(id: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedUsers.size === filteredTeam.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredTeam.map((m) => m.id)));
    }
  }

  async function handleSubmit() {
    if (!selectedCourse || selectedUsers.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/manager/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          courseId: selectedCourse,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTeam = team.filter(
    (m) =>
      m.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const selectedCourseObj = courses.find((c) => c.id === selectedCourse);
  const selectedUserNames = team
    .filter((m) => selectedUsers.has(m.id))
    .map((m) => m.name);

  if (result) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Assign Training</h1>
          <p className="page-subheader">Assignment complete</p>
        </div>
        <div className="bg-card rounded-lg border p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">
            Training Assigned Successfully
          </h2>
          <p className="text-sm text-muted-foreground">
            {result.assigned} employee{result.assigned !== 1 ? "s" : ""} assigned
            {result.skipped > 0 &&
              `, ${result.skipped} skipped (already enrolled)`}
          </p>
          <button
            onClick={() => {
              setResult(null);
              setStep(1);
              setSelectedUsers(new Set());
              setSelectedCourse(null);
              setDeadline("");
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Assign More
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Assign Training</h1>
        <p className="page-subheader">Assign courses to your team members</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-4">
        {["Select Employees", "Select Course", "Review & Assign"].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step > i + 1
                  ? "bg-success text-success-foreground"
                  : step === i + 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > i + 1 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-sm ${
                step === i + 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
            {i < 2 && <div className="w-12 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employees..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={toggleAll}
              className="ml-4 px-3 py-2 text-xs rounded-lg border hover:bg-secondary"
            >
              {selectedUsers.size === filteredTeam.length && filteredTeam.length > 0
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
          {filteredTeam.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No team members found
            </p>
          ) : (
            <div className="space-y-2">
              {filteredTeam.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(e.id)}
                    onChange={() => toggleUser(e.id)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                    {e.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <button
              disabled={selectedUsers.size === 0}
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Next: Select Course
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-card rounded-lg border p-5">
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search courses..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No published courses available
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {courses.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedCourse === c.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-secondary"
                  }`}
                >
                  <input
                    type="radio"
                    name="course"
                    checked={selectedCourse === c.id}
                    onChange={() => setSelectedCourse(c.id)}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.category ?? "Uncategorized"}
                      {c.modules ? ` · ${c.modules.length} modules` : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border rounded-lg text-sm text-foreground hover:bg-secondary"
            >
              Back
            </button>
            <button
              disabled={!selectedCourse}
              onClick={() => setStep(3)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold text-foreground mb-3">
            Assignment Summary
          </h3>
          <div className="space-y-3 mb-4">
            <div className="p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground">Selected Employees</p>
              <p className="text-sm font-medium text-foreground">
                {selectedUserNames.join(", ") || "None"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground">Selected Course</p>
              <p className="text-sm font-medium text-foreground">
                {selectedCourseObj?.title ?? "None"}
              </p>
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">
                Deadline (optional)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border rounded-lg text-sm text-foreground hover:bg-secondary"
            >
              Back
            </button>
            <button
              disabled={submitting || !selectedCourse || selectedUsers.size === 0}
              onClick={handleSubmit}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Assigning..." : "Assign Training"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
