import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Refresh session cookies and retrieve authenticated user
  const { supabaseResponse, user } = await updateSession(request);

  // Extract user role from Supabase user metadata
  const role = user?.user_metadata?.role;

  // Protect Admin dashboard routes
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirectTo=${encodeURIComponent(pathname)}`, request.url)
      );
    }
  }

  // Protect Recruiter & Company routes
  if (pathname.startsWith("/recruiter") || pathname.startsWith("/company")) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirectTo=${encodeURIComponent(pathname)}`, request.url)
      );
    }
  }

  // Protect Candidate private routes (dashboard, applications, profile, assessments, interviews)
  // Public job listings (/candidate/jobs and /candidate/jobs/[id]) are accessible without login
  if (
    pathname.startsWith("/candidate") &&
    !pathname.startsWith("/candidate/jobs")
  ) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirectTo=${encodeURIComponent(pathname)}`, request.url)
      );
    }
  }

  // If user is already authenticated and visits /login or /register, redirect to their role dashboard
  if ((pathname === "/login" || pathname === "/register") && user) {
    let target = "/candidate/dashboard";
    const userEmail = user.email?.toLowerCase() || "";
    if (role === "platform-admin" || role === "admin" || userEmail.includes("admin")) {
      target = "/admin/dashboard";
    } else if (role === "recruiter" || role === "company-admin") {
      target = "/recruiter/dashboard";
    }
    return NextResponse.redirect(new URL(target, request.url));
  }

  return supabaseResponse;
}

// Config to specify matching route paths
export const config = {
  matcher: [
    "/admin/:path*",
    "/recruiter/:path*",
    "/company/:path*",
    "/candidate/:path*",
    "/login",
    "/register",
  ],
};
