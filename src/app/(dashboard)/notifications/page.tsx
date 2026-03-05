"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock, AlertTriangle, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

const iconMap: Record<string, typeof Bell> = {
  APPROVAL: CheckCircle2,
  REJECTION: AlertTriangle,
  REMINDER: AlertTriangle,
  CERTIFICATE: CheckCircle2,
  GENERAL: Info,
};

const colorMap: Record<string, string> = {
  APPROVAL: "text-success bg-success/10",
  REJECTION: "text-destructive bg-destructive/10",
  REMINDER: "text-warning bg-warning/10",
  CERTIFICATE: "text-accent bg-accent/10",
  GENERAL: "text-info bg-info/10",
};

const typeToTab: Record<string, string> = {
  APPROVAL: "approval",
  REJECTION: "approval",
  REMINDER: "deadline",
  CERTIFICATE: "completion",
  GENERAL: "info",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  const fetchNotifications = async () => {
    const res = await fetch("/api/notifications?limit=50");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (tab === "unread") return !n.read;
    if (tab === "all") return true;
    return typeToTab[n.type] === tab;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="page-header">Notifications</h1></div>
        <div className="bg-card rounded-lg border h-96 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Notifications</h1>
          <p className="page-subheader">Stay updated with your training activities</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{unreadCount} unread</span>
          )}
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <Check className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="approval">Approvals</TabsTrigger>
          <TabsTrigger value="deadline">Deadlines</TabsTrigger>
          <TabsTrigger value="completion">Completions</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-card rounded-lg border">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notifications to show</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((n) => {
              const Icon = iconMap[n.type] || Bell;
              const colors = colorMap[n.type] || "text-muted-foreground bg-muted";
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 p-4 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colors}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm ${!n.read ? "font-semibold" : "font-medium"} text-foreground`}>{n.title}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            Mark read
                          </button>
                        )}
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
