import { NextRequest, NextResponse } from "next/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createAnonClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

/**
 * GET /api/jobs/[id]/details
 * Fetches job + company (organization schema) + recruiter real name (via SECURITY DEFINER RPC).
 * The RPC `get_recruiter_with_user` runs as DB owner, bypassing RLS on identity.users.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // 1. Fetch the job
    const { data: job, error: jobErr } = await supabase
      .schema("job")
      .from("jobs")
      .select("id, title, category, location, type, description, company_id, recruiter_id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 2. Fetch company via SECURITY DEFINER RPC (bypasses RLS on organization.companies)
    let company = null;
    if (job.company_id) {
      const { data: rows } = await supabase.rpc("get_company_details", {
        p_company_id: job.company_id,
      });

      if (rows && rows.length > 0) {
        const comp = rows[0];
        company = {
          name: comp.name,
          domain: comp.domain,
          logo_url: comp.logo_url,
          description: comp.description,
          location: [comp.city, comp.country].filter(Boolean).join(", ") || job.location || "",
          industry: comp.industry,
        };
      }
    }

    // 3. Fetch recruiter + user name via SECURITY DEFINER RPC (bypasses RLS on identity.users)
    let recruiter = null;
    if (job.recruiter_id) {
      const { data: rows, error: rpcErr } = await supabase.rpc("get_recruiter_with_user", {
        p_recruiter_id: job.recruiter_id,
      });

      if (!rpcErr && rows && rows.length > 0) {
        const row = rows[0];
        const fullName =
          [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
          row.email ||
          "Hiring Lead";
        const roleLabel = row.role
          ? row.role.charAt(0).toUpperCase() + row.role.slice(1)
          : "Recruiter";

        recruiter = {
          name: fullName,
          title: `${roleLabel} · Talent Acquisition`,
          email: row.email || "",
        };
      }
    }

    return NextResponse.json({ job, company, recruiter });
  } catch (err) {
    console.error("[/api/jobs/[id]/details] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
