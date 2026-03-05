"use client";

import { useEffect, useState } from "react";
import { User, Mail, Phone } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profilePicture: string | null;
  role: string;
  notificationPrefs: { email: boolean; inApp: boolean } | null;
}

export default function EmployeeProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [emailPref, setEmailPref] = useState(true);
  const [inAppPref, setInAppPref] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/employee/profile").then((r) => r.json()),
      fetch("/api/employee/notification-preferences").then((r) => r.json()),
    ]).then(([prof, prefs]) => {
      setProfile(prof);
      setName(prof.name ?? "");
      setPhone(prof.phone ?? "");
      setEmailPref(prefs.email ?? true);
      setInAppPref(prefs.inApp ?? true);
      setLoading(false);
    });
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg("");
    const res = await fetch("/api/employee/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: phone || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProfile((p) => (p ? { ...p, ...updated } : p));
      setSaveMsg("Profile updated successfully");
    }

    await fetch("/api/employee/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailPref, inApp: inAppPref }),
    });

    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      setPwMsg("Passwords do not match");
      return;
    }
    setChangingPw(true);
    setPwMsg("");
    const res = await fetch("/api/auth/change-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwMsg("Password changed successfully");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } else {
      setPwMsg(data.error || "Failed to change password");
    }
    setChangingPw(false);
    setTimeout(() => setPwMsg(""), 5000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="page-header">Profile & Settings</h1></div>
        <div className="bg-card rounded-lg border h-96 animate-pulse" />
      </div>
    );
  }

  const initials = (profile?.name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Profile & Settings</h1>
        <p className="page-subheader">Manage your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-card rounded-lg border p-6 text-center">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {initials || <User className="w-12 h-12 text-primary/50" />}
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{profile?.name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{profile?.role?.toLowerCase()}</p>
          <div className="mt-4 space-y-2 text-sm text-left">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" /> {profile?.email}
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" /> {profile.phone}
              </div>
            )}
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-6">
          <h2 className="font-semibold text-foreground mb-4">Edit Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-foreground block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Email</label>
              <input
                type="email"
                value={profile?.email ?? ""}
                disabled
                className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none opacity-60"
              />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+60 12-345-6789"
                className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <h3 className="font-medium text-foreground mt-6 mb-3">Notification Preferences</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={emailPref} onChange={(e) => setEmailPref(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
              <span className="text-sm text-foreground">Email notifications</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={inAppPref} onChange={(e) => setInAppPref(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
              <span className="text-sm text-foreground">In-app notifications</span>
            </label>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saveMsg && <span className="text-sm text-success">{saveMsg}</span>}
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="font-semibold text-foreground mb-4">Change Password</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label className="text-sm text-foreground block mb-1">Current Password</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1">New Password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm bg-secondary border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleChangePassword}
            disabled={changingPw || !currentPw || !newPw}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {changingPw ? "Updating..." : "Update Password"}
          </button>
          {pwMsg && <span className={`text-sm ${pwMsg.includes("success") ? "text-success" : "text-destructive"}`}>{pwMsg}</span>}
        </div>
      </div>
    </div>
  );
}
