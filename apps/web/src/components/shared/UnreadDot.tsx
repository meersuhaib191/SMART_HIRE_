"use client";

import * as React from "react";

export interface UnreadDotProps {
  /** Optional numerical count (if provided > 0, can show compact number or dot) */
  count?: number;
  /** Whether to show ping animation (default: true) */
  ping?: boolean;
  /** Custom CSS classes for positioning or sizing override */
  className?: string;
  /** Accessible label description */
  ariaLabel?: string;
  /** Size variant: 'sm' (h-2 w-2, default in Candidate Assessments) | 'md' (h-2.5 w-2.5) | 'badge' */
  size?: "sm" | "md" | "badge";
}

/**
 * SMARTHIRE UNIVERSAL RED DOT INDICATOR
 *
 * Universal indicator for new/unread activity across all SmartHire panels
 * (Candidate, Recruiter, Company, Admin).
 * Reuses the exact visual language from Candidate -> Assessments.
 */
export function UnreadDot({
  count,
  ping = true,
  className = "",
  ariaLabel = "Unread activity",
  size = "sm",
}: UnreadDotProps) {
  if (count !== undefined && count <= 0) {
    return null;
  }

  const showBadge = size === "badge" || (count !== undefined && count > 0 && size !== "sm");

  if (showBadge && count !== undefined) {
    const displayCount = count > 9 ? "9+" : String(count);
    return (
      <span
        role="status"
        aria-label={`${count} unread notifications`}
        className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold shadow-sm leading-none shrink-0 ${className}`}
      >
        {displayCount}
      </span>
    );
  }

  const dotSizeClass = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`relative flex shrink-0 ${dotSizeClass} ${className}`}
    >
      {ping && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full ${dotSizeClass} bg-red-500 shadow-sm`} />
    </span>
  );
}
