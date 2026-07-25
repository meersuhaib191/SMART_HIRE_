"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/shared/header";
import { CandidateSidebar } from "@/components/candidate-portal/CandidateSidebar";

interface CandidateLayoutProps {
  children: React.ReactNode;
}

/**
 * Candidate Root Layout.
 *
 * Automatically detects exam & coding assessment routes (/exam, /coding/[assignmentId]/exam)
 * and renders them in a 100% full-screen immersive container with NO sidebar, NO header,
 * and NO outer padding or margins.
 */
export default function CandidateLayout({ children }: CandidateLayoutProps) {
  const pathname = usePathname();
  const isExamRoute = pathname.includes("/exam") || pathname.includes("/coding/");

  if (isExamRoute) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 w-screen h-screen overflow-hidden p-0 m-0">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-w-0">
        <CandidateSidebar />
        <main className="flex-grow p-4 sm:p-6 md:p-8 text-zinc-800 overflow-y-auto max-h-[calc(100vh-64px)] min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
