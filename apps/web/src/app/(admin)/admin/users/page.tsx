"use client";

import * as React from "react";
import { Button } from "@smarthire/ui";
import { Loader2, Search, Lock, Unlock } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });

interface AdminUserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: string;
  locked?: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await candClient
        .from("candidates")
        .select("id, first_name, last_name, email, phone, created_at")
        .is("deleted_at", null);

      if (error) throw error;

      const mapped = (data || []).map((u) => ({
        ...u,
        locked: localStorage.getItem(`user_locked_${u.id}`) === "true",
      }));

      setUsers(mapped);
    } catch (err) {
      logger.error("Failed to load users for admin workspace", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleLock = (id: string, currentlyLocked?: boolean) => {
    const nextLockedState = !currentlyLocked;
    localStorage.setItem(`user_locked_${id}`, nextLockedState ? "true" : "false");

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, locked: nextLockedState } : u))
    );
    logger.info(`User ${id} lock state set to: ${nextLockedState}`);
  };

  const filteredUsers = React.useMemo(() => {
    if (!search) return users;
    const query = search.toLowerCase();
    return users.filter(
      (u) =>
        u.first_name.toLowerCase().includes(query) ||
        u.last_name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
  }, [users, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
          Platform Operations Console
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-150 mt-1">
          Registered Users
        </h1>
        <p className="text-sm text-zinc-555 dark:text-zinc-400 mt-1">
          Search user credentials database, modify role assignments, or lock/unlock candidate portal access.
        </p>
      </div>

      {/* Search Toolbar */}
      <div className="relative w-full border-b border-zinc-200/20 pb-6">
        <input
          type="text"
          placeholder="Search users by name, email coordinates, phone numbers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
        />
        <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-zinc-400" />
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-zinc-500 italic text-sm">
          No matching registered platform users found.
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">User Name</th>
                <th className="p-4">Email Coordinates</th>
                <th className="p-4">Phone Number</th>
                <th className="p-4">Registered Date</th>
                <th className="p-4">System Role</th>
                <th className="p-4 text-right">Lock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-700">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-900/10 transition-colors">
                  <td className="p-4 font-bold text-zinc-900">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="p-4 text-zinc-650">{u.email}</td>
                  <td className="p-4 text-zinc-500 font-mono">{u.phone || "--"}</td>
                  <td className="p-4 text-zinc-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-500 uppercase tracking-wider">
                      Candidate
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      onClick={() => toggleLock(u.id, u.locked)}
                      className={`h-8 px-3 text-[10px] font-bold rounded-lg ${
                        u.locked
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
                      }`}
                    >
                      {u.locked ? (
                        <span className="flex items-center gap-1">
                          <Unlock className="h-3.5 w-3.5" /> Unlock Account
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3.5 w-3.5" /> Lock Account
                        </span>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
