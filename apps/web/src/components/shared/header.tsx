"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, ChevronDown, User, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/* ─── Breadcrumb helper ──────────────────────────────────────── */
function useBreadcrumb() {
  const pathname = usePathname() || "";
  const segments = pathname.split("/").filter(Boolean);

  const labels: Record<string, string> = {
    recruiter: "Recruiter",
    admin: "Admin",
    dashboard: "Dashboard",
    jobs: "Jobs",
    pipeline: "Pipeline",
    candidates: "Candidates",
    companies: "Companies",
    users: "Users",
    subscriptions: "Subscriptions",
    "feature-flags": "Feature Flags",
    system: "System",
    create: "Create",
    edit: "Edit",
  };

  return segments
    .map((s) => labels[s] ?? s)
    .filter((s) => !["recruiter", "admin"].includes(s));
}

/* ─── Component ──────────────────────────────────────────────── */
export function Header() {
  const breadcrumbs = useBreadcrumb();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  /* Close profile dropdown on outside click */
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      window.location.href = "/login";
    }
  };

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email.split("@")[0]
    : "User";
  const userEmail = user?.email || "user@smarthire.io";
  const firstLetter = displayName.charAt(0).toUpperCase() || "U";
  const isCandidate = user?.role === "candidate";

  const profileLink = isCandidate ? "/candidate/profile" : "/recruiter/settings";
  const settingsLink = isCandidate ? "/candidate/settings" : "/recruiter/settings";

  return (
    <header className="flex h-16 w-full shrink-0 items-center justify-between border-b border-[#E8E8ED] bg-white px-6">
      {/* Left — Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px]" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <span className="text-[#AEAEB2] select-none">/</span>
            )}
            <span
              className={
                idx === breadcrumbs.length - 1
                  ? "font-semibold text-[#1D1D1F]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] cursor-default"
              }
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
        {breadcrumbs.length === 0 && (
          <span className="font-semibold text-[#1D1D1F]">Smart Hire</span>
        )}
      </nav>

      {/* Right — Actions */}
      <div className="flex items-center gap-1">
        {/* Search button */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors"
          title="Search"
          aria-label="Search"
        >
          <Search className="h-[17px] w-[17px]" />
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px]" />
          {/* Unread badge */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#FF3B30]" />
        </button>

        {/* Separator */}
        <div className="mx-2 h-5 w-px bg-[#E8E8ED]" />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
          >
            {/* Avatar */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071E3] text-white text-[11px] font-bold">
              {firstLetter}
            </div>
            <span className="hidden font-medium sm:block truncate max-w-[100px]">{displayName}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#6E6E73] transition-transform duration-150 ${
                profileOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown */}
          {profileOpen && (
            <div className="sh-scale-in absolute right-0 top-full mt-2 w-52 rounded-[16px] border border-[#D2D2D7] bg-white py-1.5 shadow-lg z-50">
              <div className="px-4 py-2.5 border-b border-[#E8E8ED]">
                <p className="text-[13px] font-semibold text-[#1D1D1F] truncate">{displayName}</p>
                <p className="text-[11px] text-[#6E6E73] mt-0.5 truncate">{userEmail}</p>
              </div>
              <div className="py-1.5">
                <Link
                  href={profileLink}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
                >
                  <User className="h-4 w-4 text-[#6E6E73]" />
                  Profile
                </Link>
                <Link
                  href={settingsLink}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
                >
                  <Settings className="h-4 w-4 text-[#6E6E73]" />
                  Settings
                </Link>
              </div>
              <div className="border-t border-[#E8E8ED] pt-1.5">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-[#FF3B30] hover:bg-[#FFF5F5] transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
