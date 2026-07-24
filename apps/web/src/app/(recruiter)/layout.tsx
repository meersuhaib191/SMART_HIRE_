import * as React from "react";
import { Header } from "@/components/shared/header";
import { Sidebar } from "@/components/shared/sidebar";

interface RecruiterLayoutProps {
  children: React.ReactNode;
}

export default function RecruiterLayout({ children }: RecruiterLayoutProps) {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#F5F5F7]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 text-[#1D1D1F] min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
