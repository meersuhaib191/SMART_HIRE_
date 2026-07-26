"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, ChevronDown, User, LogOut, Settings, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { UnreadDot } from "@/components/shared/UnreadDot";

/* ─── Breadcrumb helper ──────────────────────────────────────── */
function useBreadcrumb() {
  const pathname = usePathname() || "";
  const segments = pathname.split("/").filter(Boolean);

  const labels: Record<string, string> = {
    recruiter: "Recruiter",
    admin: "Admin",
    candidate: "Candidate",
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
    profile: "Profile Specs",
    resume: "Resume Hub",
    applications: "My Applications",
    history: "Job History",
    assessments: "Assessments",
    interviews: "Interviews",
  };

  return segments
    .map((s) => labels[s] ?? s)
    .filter((s) => !["recruiter", "admin", "candidate"].includes(s));
}

export function Header() {
  const breadcrumbs = useBreadcrumb();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [filterTab, setFilterTab] = React.useState<"all" | "unread">("all");
  const profileRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  /* Close profile & notification dropdowns on outside click */
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
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
    : "Guest User";
  const userEmail = user?.email || "guest@smarthire.io";
  const firstLetter = displayName.charAt(0).toUpperCase() || "U";
  const isCandidate = user?.role === "candidate";

  const profileLink = isCandidate ? "/candidate/profile" : "/recruiter/profile";
  const settingsLink = isCandidate ? "/candidate/settings" : "/recruiter/settings";

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === "unread") return !n.is_read;
    return true;
  });

  const getTargetUrl = (item: any) => {
    if (item.metadata?.action_url) return item.metadata.action_url;
    if (isCandidate) {
      if (item.type.includes("ASSESSMENT")) return "/candidate/assessments";
      if (item.type.includes("INTERVIEW")) return "/candidate/interviews";
      return "/candidate/applications";
    } else {
      if (item.metadata?.job_id && item.metadata?.application_id) {
        return `/recruiter/pipeline?jobId=${item.metadata.job_id}&appId=${item.metadata.application_id}`;
      }
      if (item.type.includes("OFFER")) return "/recruiter/pipeline?round=offer";
      return "/recruiter/pipeline";
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "Recently";
    }
  };

  return (
    <header className="flex h-16 w-full shrink-0 items-center justify-between border-b border-[#E8E8ED] bg-white px-4 md:px-6">
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

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors cursor-pointer"
            title="Notifications Center"
            aria-label="Notifications"
          >
            <Bell className="h-[17px] w-[17px]" />
            {unreadCount > 0 && (
              <div className="absolute -top-0.5 -right-0.5">
                <UnreadDot count={unreadCount} size="badge" />
              </div>
            )}
          </button>

          {/* Notifications Popover */}
          {notifOpen && (
            <div className="sh-scale-in absolute right-0 top-full mt-2 w-72 sm:w-96 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl z-50 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-600" />
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Notifications</h4>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      onClick={() => setFilterTab("all")}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        filterTab === "all" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterTab("unread")}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        filterTab === "unread" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      Unread
                    </button>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Read All
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredNotifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-400 font-medium italic">
                    {filterTab === "unread" ? "No unread notifications." : "No notifications available."}
                  </div>
                ) : (
                  filteredNotifications.map((n) => {
                    const targetUrl = getTargetUrl(n);
                    return (
                      <Link
                        key={n.id}
                        href={targetUrl}
                        onClick={async () => {
                          if (!n.is_read) {
                            await markAsRead(n.id);
                          }
                          setNotifOpen(false);
                        }}
                        className={`block p-3 rounded-xl border text-xs transition-all ${
                          !n.is_read
                            ? "bg-blue-50/50 border-blue-200 hover:bg-blue-50"
                            : "bg-zinc-50/60 border-zinc-100 hover:bg-zinc-100/80"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-extrabold text-zinc-900 flex items-center gap-1.5">
                            {!n.is_read && <UnreadDot size="sm" ping={true} />}
                            {n.subject}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium shrink-0">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 font-medium mt-1 leading-snug">{n.body}</p>
                      </Link>
                    );
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-[11px]">
                  <span className="text-zinc-400 font-medium">{unreadCount} Unread</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="mx-2 h-5 w-px bg-[#E8E8ED]" />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
          >
            {(user as any)?.avatarUrl ? (
              <img src={(user as any).avatarUrl} alt={displayName} className="h-7 w-7 rounded-full object-cover border border-zinc-200" />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071E3] text-white text-[11px] font-bold">
                {firstLetter}
              </div>
            )}
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
