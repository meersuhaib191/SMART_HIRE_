import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc1OTE1MSwiZXhwIjoyMDk5MzM1MTUxfQ.e8B7T2h-9R2-mP5h3vX1zL-Q7k1a3b5c7d9e1f3g5h7";

export function createAdminClient() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const url = (!envUrl || envUrl.includes("your-project") || envUrl.includes("placeholder")) ? REAL_URL : envUrl;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SERVICE_ROLE_KEY;

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
