"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  ClipboardCheck,
  UserCheck,
  Award,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { label: "User Management", icon: Users, href: "/admin/users" },
  { label: "Course Management", icon: BookOpen, href: "/admin/courses" },
  { label: "Approval Requests", icon: ClipboardCheck, href: "/admin/approvals" },
  { label: "Reports & Analytics", icon: BarChart3, href: "/admin/reports" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
];

const managerNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/manager" },
  { label: "Team Members", icon: Users, href: "/manager/team" },
  { label: "Approval Requests", icon: ClipboardCheck, href: "/manager/approvals" },
  { label: "Assign Training", icon: UserCheck, href: "/manager/assign" },
  { label: "Team Reports", icon: BarChart3, href: "/manager/reports" },
];

const employeeNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/employee" },
  { label: "Course Catalogue", icon: BookOpen, href: "/employee/catalogue" },
  { label: "My Courses", icon: GraduationCap, href: "/employee/my-courses" },
  { label: "My Certificates", icon: Award, href: "/employee/certificates" },
  { label: "My Transcript", icon: BarChart3, href: "/employee/transcript" },
  { label: "Profile & Settings", icon: Settings, href: "/employee/profile" },
];

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case "ADMIN":
      return adminNav;
    case "MANAGER":
      return managerNav;
    case "EMPLOYEE":
      return employeeNav;
    default:
      return adminNav;
  }
}

function getRoleLabel(role: string) {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "MANAGER":
      return "Manager";
    case "EMPLOYEE":
      return "Employee";
    default:
      return "";
  }
}

interface AppSidebarProps {
  role: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function AppSidebar({
  role,
  collapsed = false,
  onCollapsedChange,
}: AppSidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function fetchCount() {
      try {
        const res = await fetch("/api/notifications/count");
        if (res.ok && mounted) {
          const data = await res.json();
          setUnreadCount(data.unread ?? 0);
        }
      } catch {}
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-30 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-base leading-tight">ATMS</h1>
            <p className="text-xs text-sidebar-muted truncate">Almnfthen TMS</p>
          </div>
        )}
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-3">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
            {getRoleLabel(role)}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary shadow-sm border-l-2 border-sidebar-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-0.5 active:scale-[0.97]"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 shrink-0 transition-transform duration-200 ${!isActive ? "group-hover:scale-110" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
        <Link
          href="/notifications"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-0.5 active:scale-[0.97] transition-all duration-200 relative"
        >
          <div className="relative shrink-0">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          {!collapsed && <span>Notifications</span>}
        </Link>
        <button
          type="button"
          onClick={async () => { await signOut({ redirect: false }); window.location.href = "/login"; }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-destructive/10 hover:text-destructive hover:translate-x-0.5 active:scale-[0.97] transition-all duration-200 w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => onCollapsedChange?.(!collapsed)}
        className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-card border shadow-sm flex items-center justify-center text-foreground hover:bg-muted transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
