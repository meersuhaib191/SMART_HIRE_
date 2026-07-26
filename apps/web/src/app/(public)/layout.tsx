"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const pathname = usePathname();
  const isInterviewRoute = pathname?.startsWith("/interview");

  if (isInterviewRoute) {
    return <div className="min-h-screen bg-zinc-950 text-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      <Navbar />
      <div className="flex-grow">{children}</div>
      <Footer />
    </div>
  );
}
