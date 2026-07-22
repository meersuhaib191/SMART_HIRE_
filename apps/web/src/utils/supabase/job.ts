import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

function getSanitizedCredentials() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const url = (!envUrl || envUrl.includes("your-project") || envUrl.includes("placeholder")) ? REAL_URL : envUrl;

  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  const key = (!envKey || envKey === "your_anon_key" || envKey.includes("placeholder") || envKey.includes("your-project")) ? REAL_KEY : envKey;

  return { url, key };
}

/**
 * Creates a server-side Supabase client isolated to the 'job' database schema.
 */
export async function createJobClient() {
  const cookieStore = await cookies();
  const { url, key } = getSanitizedCredentials();

  const client = createServerClient(url, key, {
    db: {
      schema: "job",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: Record<string, unknown>;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Safe to ignore in Server Components / Route Handlers
        }
      },
    },
  });

  // Initialize and load auth session from cookies into client headers
  await client.auth.getUser().catch(() => null);

  return client;
}
