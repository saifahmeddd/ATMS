"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, ArrowLeft, Mail, KeyRound, Send } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left illustration panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-accent blur-3xl" />
          <div className="absolute bottom-32 right-16 w-56 h-56 rounded-full bg-accent blur-2xl" />
        </div>
        <div className="relative z-10 text-center max-w-md">
          <div className="w-28 h-28 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8 border border-white/10">
            <KeyRound className="w-14 h-14 text-accent" />
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Reset Your Password
          </h2>
          <p className="text-primary-foreground/70 text-lg leading-relaxed">
            Don&apos;t worry, it happens to the best of us. We&apos;ll get you
            back into your account in no time.
          </p>
          <div className="mt-10 flex items-center justify-center gap-2 text-primary-foreground/50 text-sm">
            <div className="w-8 h-[1px] bg-primary-foreground/20" />
            Secure &amp; encrypted
            <div className="w-8 h-[1px] bg-primary-foreground/20" />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              ATMS
            </h1>
          </div>

          {!submitted ? (
            <>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Forgot Password?
              </h2>
              <p className="text-muted-foreground mb-8">
                No worries. Enter the email linked to your account and
                we&apos;ll send a reset link.
              </p>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@almnfthen.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 text-sm bg-card border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Mail className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">
                Check Your Inbox
              </h2>
              <p className="text-muted-foreground mb-2 max-w-sm mx-auto">
                We&apos;ve sent a password reset link to
              </p>
              <p className="font-semibold text-foreground mb-8">{email}</p>
              <div className="bg-muted/50 rounded-xl p-4 mb-6 text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-primary font-medium hover:underline"
                >
                  try again
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
