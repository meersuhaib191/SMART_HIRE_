import * as React from "react";

/* ── Primitive ──────────────────────────────────────────────── */
interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`sh-skeleton ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/* ── Metric Card Skeleton ───────────────────────────────────── */
export function SkeletonMetric() {
  return (
    <div className="rounded-[16px] border border-[#E8E8ED] bg-white p-6 flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-[12px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-2.5 w-20 rounded-md" />
      </div>
    </div>
  );
}

/* ── Table Row Skeleton ─────────────────────────────────────── */
const DETERMINISTIC_WIDTHS = ["75%", "85%", "65%", "80%", "70%"];

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton
            className="h-4 rounded-md"
            style={{ width: DETERMINISTIC_WIDTHS[i % DETERMINISTIC_WIDTHS.length] }}
          />
        </td>
      ))}
    </tr>
  );
}

/* ── Table Skeleton ─────────────────────────────────────────── */
export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-[16px] border border-[#D2D2D7] bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-[#E8E8ED] bg-[#F5F5F7] px-6 py-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 rounded-md flex-1" />
        ))}
      </div>
      {/* Rows */}
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Card Skeleton ──────────────────────────────────────────── */
export function SkeletonCard() {
  return (
    <div className="rounded-[16px] border border-[#E8E8ED] bg-white p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 rounded-md" />
          <Skeleton className="h-5 w-40 rounded-md" />
        </div>
        <Skeleton className="h-7 w-20 rounded-[8px]" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-md" />
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-[#E8E8ED]">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

/* ── Page Header Skeleton ───────────────────────────────────── */
export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20 rounded-md" />
      <Skeleton className="h-9 w-72 rounded-md" />
      <Skeleton className="h-3 w-96 rounded-md" />
    </div>
  );
}

/* ── Dashboard Skeleton ─────────────────────────────────────── */
export function SkeletonDashboard() {
  return (
    <div className="space-y-8 sh-animate-in">
      <SkeletonPageHeader />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonMetric key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
