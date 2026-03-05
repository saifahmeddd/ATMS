"use client";

import AppSidebar from "./AppSidebar";
import { useState } from "react";

interface DashboardShellProps {
  role: string;
  children: React.ReactNode;
}

export default function DashboardShell({ role, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 64 : 256;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar role={role} collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <main
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
