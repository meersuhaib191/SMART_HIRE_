import type { Metadata } from "next";
import "./globals.css";
import { NotificationProvider } from "@/providers/NotificationContext";

export const metadata: Metadata = {
  title: "Smart Hire — Modern Hiring Platform",
  description: "Smart Hire is a premium enterprise hiring platform for modern recruiting teams.",
  keywords: ["hiring", "recruiting", "ATS", "applicant tracking", "talent acquisition"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F5F5F7] text-[#1D1D1F]">
        <NotificationProvider>{children}</NotificationProvider>
      </body>
    </html>
  );
}

