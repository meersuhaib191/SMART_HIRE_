import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const url = (!envUrl || envUrl.includes("your-project") || envUrl.includes("placeholder")) ? REAL_URL : envUrl;

  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  const key = (!envKey || envKey === "your_anon_key" || envKey.includes("placeholder") || envKey.includes("your-project")) ? REAL_KEY : envKey;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Prune duplicate or stale auth token chunks to keep header size minimal
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            sameSite: "lax",
            secure: true,
          })
        );
      },
    },
  });

  // Refresh token if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
