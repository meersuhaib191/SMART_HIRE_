"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Layers,
  Users,
  Building2,
  CreditCard,
  Flag,
  Settings2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  History,
  Menu,
  X,
} from "lucide-react";

import { useNotifications } from "@/hooks/use-notifications";
import { UnreadDot } from "@/components/shared/UnreadDot";

/* ─── Types ─────────────────────────────────────────────────── */
interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
  category?: "pipeline" | "jobs" | "offers" | "admin" | "applications";
}

/* ─── Data ───────────────────────────────────────────────────── */
const adminLinks: NavLink[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Candidates", href: "/admin/candidates", icon: Users },
  { label: "Recruiters", href: "/admin/recruiters", icon: Briefcase },
  { label: "Companies", href: "/admin/companies", icon: Building2 },
  { label: "All Jobs", href: "/admin/jobs", icon: FileSpreadsheet },
  { label: "Applications", href: "/admin/applications", icon: Layers },
  { label: "Security & Admin", href: "/admin/security", icon: Settings2, category: "admin" },
];

const recruiterLinks: NavLink[] = [
  { label: "Dashboard", href: "/recruiter/dashboard", icon: LayoutDashboard },
  { label: "Jobs", href: "/recruiter/jobs", icon: Briefcase, category: "jobs" },
  { label: "Pipeline", href: "/recruiter/pipeline", icon: Layers, category: "pipeline" },
  { label: "Candidates", href: "/recruiter/candidates", icon: FileSpreadsheet },
  { label: "Hiring History", href: "/recruiter/history", icon: History },
];

/* ─── Component ──────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname() || "";
  const isAdmin = pathname.startsWith("/admin");
  const links = isAdmin ? adminLinks : recruiterLinks;
  const workspaceName = isAdmin ? "Admin Console" : "Recruiter Console";
  const { hasUnreadForContext } = useNotifications();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close mobile drawer on route navigation
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Mobile Top Toggle Bar ── */}
      <div className="flex md:hidden items-center justify-between bg-white border-b border-[#E8E8ED] px-4 py-3 shrink-0 text-left">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#0071E3] text-white text-xs font-bold shadow-sm">
            S
          </div>
          <div>
            <span className="block text-sm font-bold text-[#1D1D1F] tracking-tight leading-none">Smart Hire</span>
            <span className="block text-[10px] font-semibold text-[#6E6E73] mt-0.5">{workspaceName}</span>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle Navigation Menu"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] transition-colors text-xs font-bold"
        >
          {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          <span>Menu</span>
        </button>
      </div>

      {/* ── Mobile Navigation Drawer Backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200 text-left"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E8E8ED] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#0071E3] text-white text-sm font-bold shadow-sm">
                    S
                  </div>
                  <div>
                    <span className="block text-base font-bold text-[#1D1D1F] tracking-tight">Smart Hire</span>
                    <span className="block text-xs font-medium text-[#6E6E73]">{workspaceName}</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex flex-col gap-1">
                {links.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    (link.href !== "/recruiter/dashboard" &&
                      link.href !== "/admin/dashboard" &&
                      pathname.startsWith(link.href));
                  const Icon = link.icon;
                  const isUnread = link.category ? hasUnreadForContext({ category: link.category }) : false;

                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`flex items-center justify-between rounded-[12px] px-3.5 py-3 text-xs font-bold transition-all ${
                        isActive
                          ? "bg-[#0071E3] text-white shadow-sm"
                          : "text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-white" : "text-[#AEAEB2]"}`} />
                        <span>{link.label}</span>
                      </div>
                      {isUnread && <UnreadDot size="sm" />}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-[#E8E8ED] text-[11px] font-semibold text-[#86868B] text-center">
              {workspaceName} Portal
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Desktop Sidebar ── */}
      <aside
        className={`
          hidden md:flex relative h-screen flex-col border-r border-[#D2D2D7] bg-white
          transition-all duration-300 ease-in-out shrink-0 text-left
          ${collapsed ? "w-[72px]" : "w-[240px]"}
        `}
        style={{ userSelect: "none" }}
      >
        {/* ── Logo lockup ── */}
        <div className="flex h-16 items-center gap-3 border-b border-[#E8E8ED] px-4 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#0071E3] text-white text-sm font-bold shadow-sm">
            S
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <span className="block text-[15px] font-semibold text-[#1D1D1F] tracking-tight leading-tight truncate">
                Smart Hire
              </span>
              <span className="block text-[11px] text-[#6E6E73] font-medium truncate">
                {workspaceName}
              </span>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4 no-scrollbar">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/recruiter/dashboard" &&
                link.href !== "/admin/dashboard" &&
                pathname.startsWith(link.href));
            const Icon = link.icon;
            const isUnread = link.category ? hasUnreadForContext({ category: link.category }) : false;

            return (
              <Link
                key={link.label}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={`
                  group flex items-center gap-3 rounded-[12px] px-3 py-[10px] text-[13px] font-medium
                  transition-all duration-150
                  ${collapsed ? "justify-center" : "justify-between"}
                  ${
                    isActive
                      ? "bg-[#0071E3] text-white shadow-sm"
                      : "text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                  }
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`shrink-0 transition-colors ${
                      collapsed ? "h-[18px] w-[18px]" : "h-[16px] w-[16px]"
                    } ${isActive ? "text-white" : "text-[#AEAEB2] group-hover:text-[#1D1D1F]"}`}
                  />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </div>
                {isUnread && <UnreadDot size="sm" />}
              </Link>
            );
          })}
        </nav>

        {/* ── Collapse toggle ── */}
        <div className="flex shrink-0 items-center justify-center border-t border-[#E8E8ED] px-3 py-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#AEAEB2] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
