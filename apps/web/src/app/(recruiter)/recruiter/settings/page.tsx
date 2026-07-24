"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@smarthire/ui";
import { KeyRound, Bell, ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, UserCheck, ArrowRight } from "lucide-react";
import { logger } from "@smarthire/logger";

const supabase = createClient();

export default function SettingsPage() {
  // Password State
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPass, setShowNewPass] = React.useState(false);
  const [showConfirmPass, setShowConfirmPass] = React.useState(false);
  const [updatingPassword, setUpdatingPassword] = React.useState(false);

  // Notification Toggles State
  const [emailOnApplication, setEmailOnApplication] = React.useState(true);
  const [emailOnAssessment, setEmailOnAssessment] = React.useState(true);
  const [weeklyDigest, setWeeklyDigest] = React.useState(false);

  // Alert Feedback State
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Change Password Handler
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords do not match. Please verify.");
      return;
    }

    setUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw new Error(error.message || "Failed to update password.");
      }

      setSuccessMsg("✅ Password updated successfully! Your account credentials have been updated.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      logger.error("Password update error", err);
      setErrorMsg(msg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4 text-left sh-animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E8ED] pb-6">
        <div>
          <span className="text-[11px] font-extrabold text-[#0071E3] uppercase tracking-widest block">
            Account Console
          </span>
          <h1 className="text-[30px] font-extrabold text-[#1D1D1F] tracking-tight mt-1">
            Account Settings & Security
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-1 font-medium">
            Manage your account password credentials, security preferences, and email notifications.
          </p>
        </div>

        <Link href="/recruiter/profile">
          <Button variant="outline" className="border-zinc-200 hover:bg-zinc-100 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer">
            <UserCheck className="h-4 w-4 text-blue-600" /> Go to Recruiter Profile <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {errorMsg && (
        <div className="rounded-2xl bg-[#FFF0EE] border border-[#FFCFCC] p-4 text-xs font-semibold text-[#FF3B30]">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl bg-[#EAFBEE] border border-[#C5F0D2] p-4 text-xs font-semibold text-[#1A7F36]">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* CHANGE PASSWORD CARD */}
        <div className="md:col-span-7 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-zinc-900">Change Account Password</h3>
              <p className="text-xs text-zinc-500 font-medium">Ensure your account is using a long, random password to stay secure.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block">New Password *</label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block">Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm new password"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {newPassword && confirmPassword && (
              <div className="text-xs font-semibold flex items-center gap-1.5">
                {newPassword === confirmPassword ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                  </span>
                ) : (
                  <span className="text-red-500">Passwords do not match</span>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={updatingPassword || !newPassword || newPassword !== confirmPassword}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                {updatingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* NOTIFICATIONS & SECURITY SUMMARY */}
        <div className="md:col-span-5 space-y-6">
          {/* Security Status Card */}
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-emerald-100 pb-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-extrabold text-zinc-900">Security Credentials</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-600 font-medium">Session Protection</span>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full text-[11px]">
                  Encrypted SSL
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-600 font-medium">Auth Provider</span>
                <span className="font-bold text-zinc-900">Supabase Auth</span>
              </div>
            </div>
          </div>

          {/* Email Notifications Preferences Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-3">
              <Bell className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-zinc-900">Notification Alerts</h3>
            </div>

            <div className="space-y-4 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-bold text-zinc-900 block">Candidate Applications</span>
                  <span className="text-[11px] text-zinc-500 font-medium">Email when a candidate submits an application.</span>
                </div>
                <input
                  type="checkbox"
                  checked={emailOnApplication}
                  onChange={(e) => setEmailOnApplication(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer border-t border-zinc-100 pt-3">
                <div>
                  <span className="font-bold text-zinc-900 block">Assessment Completion</span>
                  <span className="text-[11px] text-zinc-500 font-medium">Email when a candidate finishes an exam.</span>
                </div>
                <input
                  type="checkbox"
                  checked={emailOnAssessment}
                  onChange={(e) => setEmailOnAssessment(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer border-t border-zinc-100 pt-3">
                <div>
                  <span className="font-bold text-zinc-900 block">Weekly Funnel Digest</span>
                  <span className="text-[11px] text-zinc-500 font-medium">Receive weekly candidate summary email.</span>
                </div>
                <input
                  type="checkbox"
                  checked={weeklyDigest}
                  onChange={(e) => setWeeklyDigest(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
