"use client";

import * as React from "react";
import { ShieldCheck, Key, Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { logger } from "@smarthire/logger";
import { useAuth } from "@/hooks/use-auth";

export default function AdminSecurityPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirm password do not match.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setSuccessMsg("✅ Admin password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setErrorMsg(msg);
      logger.error("Admin password change error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-5">
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
          Platform Security & Admin Credentials
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 mt-0.5">
          Admin Security Settings
        </h1>
        <p className="text-xs text-zinc-500 mt-1 font-medium">
          Update administrative password and authentication parameters securely using Supabase Auth.
        </p>
      </div>

      {/* Account Info */}
      <div className="p-4 rounded-xl border border-zinc-200 bg-white shadow-2xs space-y-1">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Logged In Admin</span>
        <p className="font-extrabold text-sm text-zinc-900">{user?.firstName} {user?.lastName}</p>
        <p className="text-xs font-mono text-blue-600">{user?.email}</p>
      </div>

      {/* Change Password Form */}
      <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
          <Key className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-extrabold text-zinc-900">Change Admin Password</h3>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs h-10 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating Credentials...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Save New Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
