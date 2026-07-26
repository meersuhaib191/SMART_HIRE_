import { createServerClient } from "@supabase/ssr";

/**
 * Creates a server-side Supabase client isolated to the 'notification' database schema.
 */
export async function createNotificationClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const client = createServerClient(
    (() => { const e = process.env.NEXT_PUBLIC_SUPABASE_URL || ""; return (!e || e.includes("your-project") || e.includes("placeholder")) ? "https://yljipgjfkfwacaspifcq.supabase.co" : e; })(),
    (() => { const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""; return (!k || k === "your_anon_key" || k.includes("placeholder") || k.includes("your-project")) ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg" : k; })(),
    {
      db: {
        schema: "notification",
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
    }
  );

  // Initialize and load auth session from cookies into client headers
  await client.auth.getUser().catch(() => null);

  return client;
}
