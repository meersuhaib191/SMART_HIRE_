import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@smarthire/logger";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    logger.info(`[API/Auth/Login] Attempting server-side login for: ${email}`);

    const cookieStore = await cookies();
    let response = NextResponse.json({ success: true });

    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const url = (!envUrl || envUrl.includes("your-project") || envUrl.includes("placeholder")) ? REAL_URL : envUrl;

    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const key = (!envKey || envKey === "your_anon_key" || envKey.includes("placeholder") || envKey.includes("your-project")) ? REAL_KEY : envKey;

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore inside route handler if needed
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error("[API/Auth/Login] Sign in failed", error);
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    // Return final JSON with set-cookie headers attached
    const finalResponse = NextResponse.json(
      { user: data.user, session: data.session },
      { status: 200 }
    );

    // Forward all cookies set by Supabase auth to the client response
    cookieStore.getAll().forEach((c) => {
      finalResponse.cookies.set(c.name, c.value);
    });

    logger.info(`[API/Auth/Login] Login successful for user: ${data.user?.id}`);
    return finalResponse;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("[API/Auth/Login] Unexpected error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
