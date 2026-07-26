"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { resolveCandidateProfileIds } from "@/utils/candidate-helper";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { UnreadDot } from "@/components/shared/UnreadDot";
import { Button } from "@smarthire/ui";
import {
  LayoutDashboard,
  User,
  FileText,
  Briefcase,
  FileSpreadsheet,
  History,
  ClipboardCheck,
  Calendar,
  Menu,
  X,
  LogOut,
  LogIn,
  Settings,
  Gift,
} from "lucide-react";

export function CandidateSidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { hasUnreadForContext } = useNotifications();
  const [hasSoonExam, setHasSoonExam] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const checkSoonExam = async () => {
      try {
        const supabase = createClient();
        const authRes = await supabase.auth.getUser().catch(() => null);
        const userObj = authRes?.data?.user;
        if (!userObj) return;

        const candIds = await resolveCandidateProfileIds(supabase, userObj);
        if (candIds.length === 0) return;

        const { data: assignments } = await supabase
          .schema("assessment")
          .from("assignments")
          .select("status, scheduled_start_at, expires_at")
          .in("candidate_id", candIds);

        if (!active) return;

        const soon = (assignments || []).some((item) => {
          if (item.status === "completed") return false;
          if (!item.scheduled_start_at) return false;

          const startTime = new Date(item.scheduled_start_at);
          const now = new Date();
          const oneDay = 24 * 60 * 60 * 1000;
          const timeDiff = startTime.getTime() - now.getTime();

          const startsSoon = timeDiff > 0 && timeDiff <= oneDay;
          const isCurrent = timeDiff <= 0 && (!item.expires_at || new Date(item.expires_at) > now);

          return startsSoon || isCurrent;
        });

        setHasSoonExam(soon);
      } catch {
        // Silent catch for potential connection errors
      }
    };

    checkSoonExam();
    const interval = setInterval(checkSoonExam, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile menu when route changes
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const links = [
    { label: "Dashboard", href: "/candidate/dashboard", icon: LayoutDashboard },
    { label: "Profile Specs", href: "/candidate/profile", icon: User },
    { label: "Resume Hub", href: "/candidate/resume", icon: FileText },
    { label: "Search Jobs", href: "/candidate/jobs", icon: Briefcase },
    { label: "My Applications", href: "/candidate/applications", icon: FileSpreadsheet, category: "applications" as const },
    { label: "Job History", href: "/candidate/history", icon: History },
    { label: "Assessments", href: "/candidate/assessments", icon: ClipboardCheck, category: "assessments" as const },
    { label: "Interviews", href: "/candidate/interviews", icon: Calendar, category: "interviews" as const },
    { label: "My Offers", href: "/candidate/offers", icon: Gift, category: "offers" as const },
  ];

  const checkItemUnread = (link: (typeof links)[0]) => {
    if (link.label === "Assessments" && hasSoonExam) return true;
    if (link.category) {
      return hasUnreadForContext({ category: link.category });
    }
    return false;
  };

  return (
    <>
      {/* Mobile Phone Navigation Bar */}
      <div className="flex md:hidden items-center justify-between bg-white border-b border-zinc-200 px-4 py-3 shrink-0 text-left">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
            S
          </div>
          <span className="text-sm font-extrabold text-zinc-900 tracking-tight">Smart Hire</span>
        </div>

        <div className="flex items-center gap-2">
          {!isAuthenticated && (
            <Link href="/login">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                Sign In
              </Button>
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors flex items-center gap-1 border border-zinc-200"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="text-xs font-bold">Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200 text-left overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    S
                  </div>
                  <span className="text-base font-extrabold text-zinc-900 tracking-tight">Smart Hire</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Sign-In Banner if Guest */}
              {!isAuthenticated ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-left">
                  <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <LogIn className="h-3.5 w-3.5 text-blue-600" />
                    Guest Candidate View
                  </p>
                  <p className="text-[11px] text-blue-700 mt-1 leading-snug">
                    Sign in to access your candidate profile, applications, and assessment tests.
                  </p>
                  <Link href="/login" className="block mt-2.5">
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg">
                      Sign In Now
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 mb-4 text-left flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {user?.firstName?.charAt(0) || "U"}
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-xs font-bold text-zinc-900 truncate">{user?.firstName} {user?.lastName}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="flex flex-col gap-1">
                {links.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  const isUnread = checkItemUnread(link);

                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                        <span>{link.label}</span>
                      </div>
                      {isUnread && <UnreadDot size="sm" className="mr-1" />}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-zinc-100 text-[11px] font-semibold text-zinc-400 text-center">
              Candidate Workspace Portal
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r border-zinc-200 bg-white px-4 py-6 text-zinc-800 shrink-0 text-left">
        <div className="mb-8 px-3.5 flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
            S
          </div>
          <span className="text-base font-extrabold tracking-tight text-zinc-800">
            Smart Hire
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5">
          {links.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            const isUnread = checkItemUnread(link);

            return (
              <Link
                key={link.label}
                href={link.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/10"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{link.label}</span>
                </div>
                {isUnread && <UnreadDot size="sm" className="mr-1" />}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
