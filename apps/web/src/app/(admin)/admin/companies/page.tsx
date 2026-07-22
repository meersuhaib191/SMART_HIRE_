"use client";

import * as React from "react";
import { Button } from "@smarthire/ui";
import { Loader2, Building, CheckCircle, Ban } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const orgClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "organization" } });

interface CompanyRow {
  id: string;
  name: string;
  industry?: string;
  country?: string;
  website?: string;
  created_at: string;
  status?: string; // suspended or active
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = React.useState<CompanyRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchCompanies = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await orgClient
        .from("companies")
        .select("id, name, industry, country, website, created_at");

      if (error) throw error;

      // Add a client-side simulated status toggle
      const mapped = (data || []).map((c) => ({
        ...c,
        status: localStorage.getItem(`company_suspended_${c.id}`) === "true" ? "suspended" : "active",
      }));

      setCompanies(mapped);
    } catch (err) {
      logger.error("Failed to load companies listing", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const toggleSuspension = (id: string, currentStatus?: string) => {
    const isSuspended = currentStatus === "suspended";
    const nextStatus = isSuspended ? "active" : "suspended";

    localStorage.setItem(`company_suspended_${id}`, isSuspended ? "false" : "true");

    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
    );
    logger.info(`Company ${id} suspension status toggled to: ${nextStatus}`);
  };

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
          Registered Companies
        </h1>
        <p className="text-sm text-zinc-555 dark:text-zinc-400 mt-1">
          Audit tenant organizations, manage billing subscription structures, or toggle workspace locks.
        </p>
      </div>

      {/* Companies Table */}
      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-zinc-500 italic text-sm">
          No registered companies found on the tenant platform.
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">Company Name</th>
                <th className="p-4">Industry</th>
                <th className="p-4">Office Region</th>
                <th className="p-4">Website</th>
                <th className="p-4">Registered Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-700">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-900/10 transition-colors">
                  <td className="p-4 font-bold text-zinc-900">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-zinc-500" />
                      <span>{c.name}</span>
                    </div>
                  </td>
                  <td className="p-4 capitalize text-zinc-650 font-medium">
                    {c.industry || "Technology"}
                  </td>
                  <td className="p-4 text-zinc-650">
                    {c.country || "United States"}
                  </td>
                  <td className="p-4">
                    {c.website ? (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {c.website}
                      </a>
                    ) : (
                      <span className="text-zinc-550">--</span>
                    )}
                  </td>
                  <td className="p-4 text-zinc-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      onClick={() => toggleSuspension(c.id, c.status)}
                      className={`h-8 px-3 text-[10px] font-bold rounded-lg ${
                        c.status === "suspended"
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600/20"
                      }`}
                    >
                      {c.status === "suspended" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Reactivate
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Ban className="h-3 w-3" /> Suspend
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
