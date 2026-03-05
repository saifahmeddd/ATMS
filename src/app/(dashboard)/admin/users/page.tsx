"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit, Trash2, UserCheck, UserX, Upload } from "lucide-react";
import UserModal from "@/components/admin/UserModal";
import DeleteDialog from "@/components/admin/DeleteDialog";
import BulkImportModal from "@/components/admin/BulkImportModal";
import { format } from "date-fns";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  managerId: string | null;
  createdAt: string;
  manager?: { id: string; name: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (searchDebounced) params.set("search", searchDebounced);
      if (roleFilter !== "All") params.set("role", roleFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);

      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users ?? []);
      if (data.pagination) setPagination(data.pagination);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchDebounced, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteUser(null);
      fetchUsers();
    } catch {
      // Error handled by parent / could add toast
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map((u) => u.id)));
  }

  async function handleBulkStatus(status: "ACTIVE" | "INACTIVE") {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      await fetch("/api/users/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds), status }),
      });
      setSelectedIds(new Set());
      fetchUsers();
    } finally {
      setBulkUpdating(false);
    }
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Admin";
      case "MANAGER":
        return "Manager";
      case "EMPLOYEE":
        return "Employee";
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">User Management</h1>
          <p className="page-subheader">Manage system users and their roles</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditUser(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", "Admin", "Manager", "Employee"].map((role) => {
            const apiRole = role === "All" ? "All" : role.toUpperCase();
            return (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(apiRole)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  roleFilter === apiRole
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border text-foreground hover:bg-secondary"
                }`}
              >
                {role}
              </button>
            );
          })}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="All">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-foreground font-medium">{selectedIds.size} selected</span>
          <button
            onClick={() => handleBulkStatus("ACTIVE")}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-xs bg-success/10 text-success rounded-lg hover:bg-success/20 disabled:opacity-50 transition-colors"
          >
            Set Active
          </button>
          <button
            onClick={() => handleBulkStatus("INACTIVE")}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-xs bg-warning/10 text-warning rounded-lg hover:bg-warning/20 disabled:opacity-50 transition-colors"
          >
            Set Inactive
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  <th className="py-3 px-4 w-10">
                    <input type="checkbox" checked={selectedIds.size === users.length && users.length > 0} onChange={toggleAll} className="accent-primary" />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Manager
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Joined
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0 hover:bg-secondary/30"
                  >
                    <td className="py-3 px-4 w-10">
                      <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelect(user.id)} className="accent-primary" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <span className="font-medium text-foreground">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          user.role === "ADMIN"
                            ? "bg-primary/10 text-primary"
                            : user.role === "MANAGER"
                              ? "bg-info/10 text-info"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {user.manager?.name ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`flex items-center gap-1.5 text-xs ${
                          user.status === "ACTIVE"
                            ? "text-success"
                            : "text-muted-foreground"
                        }`}
                      >
                        {user.status === "ACTIVE" ? (
                          <UserCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditUser(user);
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-secondary transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteUser(user)}
                          className="p-1.5 rounded hover:bg-secondary transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {(pagination.page - 1) * pagination.limit + 1}–
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} users
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() =>
              setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
            }
            className="px-3 py-1.5 rounded border bg-card hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5">
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              setPagination((p) => ({
                ...p,
                page: Math.min(p.totalPages, p.page + 1),
              }))
            }
            className="px-3 py-1.5 rounded border bg-card hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      <UserModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditUser(null);
        }}
        onSuccess={fetchUsers}
        editUser={editUser}
      />

      <DeleteDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        itemName={deleteUser ? `${deleteUser.name} (${deleteUser.email})` : undefined}
        loading={deleteLoading}
      />

      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
