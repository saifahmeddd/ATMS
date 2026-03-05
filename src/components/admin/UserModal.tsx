"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  status: "ACTIVE" | "INACTIVE";
  managerId: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  managerId: string | null;
  manager?: { id: string; name: string } | null;
}

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editUser: User | null;
}

export default function UserModal({
  open,
  onClose,
  onSuccess,
  editUser,
}: UserModalProps) {
  const isEdit = !!editUser;
  const [form, setForm] = useState<UserFormData>({
    name: "",
    email: "",
    password: "",
    role: "EMPLOYEE",
    status: "ACTIVE",
    managerId: null,
  });
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editUser) {
      setForm({
        name: editUser.name,
        email: editUser.email,
        password: "",
        role: editUser.role as "ADMIN" | "MANAGER" | "EMPLOYEE",
        status: editUser.status as "ACTIVE" | "INACTIVE",
        managerId: editUser.managerId ?? null,
      });
    } else {
      setForm({
        name: "",
        email: "",
        password: "",
        role: "EMPLOYEE",
        status: "ACTIVE",
        managerId: null,
      });
    }
    setError("");
  }, [editUser, open]);

  useEffect(() => {
    async function fetchManagers() {
      try {
        const res = await fetch("/api/users?role=MANAGER&limit=100");
        if (res.ok) {
          const data = await res.json();
          setManagers(data.users ?? []);
        }
      } catch {
        setManagers([]);
      }
    }
    if (open) fetchManagers();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isEdit && (!form.password || form.password.length < 8)) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        status: form.status,
        managerId: form.role === "EMPLOYEE" ? form.managerId : null,
      };
      if (form.password) body.password = form.password;

      const url = isEdit ? `/api/users/${editUser.id}` : "/api/users";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit User" : "Add New User"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="john@almnfthen.com"
              disabled={isEdit}
              title={isEdit ? "Email cannot be changed" : undefined}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Password {isEdit && "(leave blank to keep current)"}
            </label>
            <input
              type="password"
              value={form.password ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value || undefined }))
              }
              required={!isEdit}
              minLength={8}
              className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder={isEdit ? "••••••••" : "Min 8 characters"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as "ADMIN" | "MANAGER" | "EMPLOYEE",
                    managerId:
                      e.target.value === "EMPLOYEE" ? f.managerId : null,
                  }))
                }
                className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as "ACTIVE" | "INACTIVE",
                  }))
                }
                className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {form.role === "EMPLOYEE" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Manager
              </label>
              <select
                value={form.managerId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    managerId: e.target.value || null,
                  }))
                }
                className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg border bg-card hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
