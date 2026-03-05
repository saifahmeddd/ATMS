"use client";

import { useState } from "react";
import { Bell, Mail, Shield, Globe } from "lucide-react";

interface ToggleItem {
  label: string;
  key: string;
}

const notificationToggles: ToggleItem[] = [
  { label: "Email notifications for new enrollments", key: "enroll" },
  { label: "Deadline reminders (7, 3, 1 days)", key: "deadlines" },
  { label: "Course completion alerts", key: "completion" },
  { label: "System maintenance notifications", key: "maintenance" },
];

export default function AdminSettingsPage() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    enroll: true,
    deadlines: true,
    completion: true,
    maintenance: false,
  });
  const [saved, setSaved] = useState(false);

  function toggle(key: string) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">General Settings</h1>
        <p className="page-subheader">Configure system-wide settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notification Settings */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Notification Settings</h2>
          </div>
          <div className="space-y-4">
            {notificationToggles.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                <button
                  onClick={() => toggle(item.key)}
                  className={`w-11 h-6 rounded-full transition-colors ${toggles[item.key] ? "bg-primary" : "bg-muted"}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-card shadow transition-transform ${
                      toggles[item.key] ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Security Settings</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-foreground block mb-1">Session Timeout (minutes)</label>
              <input type="number" defaultValue={30} className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Max Login Attempts</label>
              <input type="number" defaultValue={5} className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Password Min Length</label>
              <input type="number" defaultValue={8} className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Email Configuration</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-foreground block mb-1">SMTP Host</label>
              <input type="text" defaultValue="smtp.almnfthen.com" className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">SMTP Port</label>
              <input type="number" defaultValue={587} className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Sender Email</label>
              <input type="email" defaultValue="noreply@almnfthen.com" className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">System Settings</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-foreground block mb-1">System Name</label>
              <input type="text" defaultValue="Almnfthen TMS" className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Default Quiz Pass Rate (%)</label>
              <input type="number" defaultValue={80} className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Max File Upload Size (MB)</label>
              <input type="number" defaultValue={50} className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-success">Settings saved</span>}
        <button
          onClick={() => setSaved(true)}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
