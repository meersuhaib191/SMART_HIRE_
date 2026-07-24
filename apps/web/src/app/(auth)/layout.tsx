import * as React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-zinc-900 px-4 py-10 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Dynamic light ambient gradient background */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.12),transparent)] pointer-events-none" />
      <div className="absolute top-1/4 -left-20 -z-10 h-96 w-96 bg-blue-400/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 -right-20 -z-10 h-96 w-96 bg-indigo-400/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Background Subtle Grid Pattern */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="w-full max-w-5xl z-10 my-auto">
        {children}
      </div>
    </div>
  );
}
