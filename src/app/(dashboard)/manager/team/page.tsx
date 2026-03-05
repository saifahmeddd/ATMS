"use client";

import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  userStatus: string;
  courses: number;
  completed: number;
  progress: number;
  status: string;
}

export default function ManagerTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTeam = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/manager/team?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Team Members</h1>
        <p className="page-subheader">
          View and manage your team&apos;s training assignments
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search team members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Member
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Email
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Courses
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Completed
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Progress
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {debouncedSearch
                    ? "No members match your search"
                    : "No team members yet"}
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.id}
                  className="border-b last:border-0 hover:bg-secondary/30"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                        {m.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{m.email}</td>
                  <td className="py-3 px-4 text-foreground">{m.courses}</td>
                  <td className="py-3 px-4 text-foreground">{m.completed}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            m.progress >= 80
                              ? "bg-success"
                              : m.progress >= 50
                                ? "bg-warning"
                                : "bg-destructive"
                          }`}
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {m.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        m.status === "Completed"
                          ? "bg-success/10 text-success"
                          : m.status === "On Track"
                            ? "bg-info/10 text-info"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
