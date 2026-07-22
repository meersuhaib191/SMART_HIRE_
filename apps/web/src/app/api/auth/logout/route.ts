import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@smarthire/logger";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

export async function POST() {
  try {
    logger.info("[API/Auth/Logout] Attempting server-side sign out");

    const cookieStore = await cookies();

    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const url = (!envUrl || envUrl.includes("your-project") || envUrl.includes("placeholder")) ? REAL_URL : envUrl;

    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const key = (!envKey || envKey === "your_anon_key" || envKey.includes("placeholder") || envKey.includes("your-project")) ? REAL_KEY : envKey;

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore
            }
          });
        },
      },
    });

    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error("[API/Auth/Logout] Sign out failed", error);
    }

    // Clear all Supabase session cookies regardless of signOut result
    const finalResponse = NextResponse.json({ success: true }, { status: 200 });
    cookieStore.getAll().forEach((c) => {
      if (c.name.startsWith("sb-")) {
        finalResponse.cookies.set(c.name, "", { maxAge: 0, path: "/" });
      }
    });

    logger.info("[API/Auth/Logout] Sign out completed");
    return finalResponse;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("[API/Auth/Logout] Unexpected error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
