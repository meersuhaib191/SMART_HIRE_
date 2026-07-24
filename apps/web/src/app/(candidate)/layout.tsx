import * as React from "react";
import { Header } from "@/components/shared/header";
import { CandidateSidebar } from "@/components/candidate-portal/CandidateSidebar";

interface CandidateLayoutProps {
  children: React.ReactNode;
}

export default function CandidateLayout({ children }: CandidateLayoutProps) {
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
