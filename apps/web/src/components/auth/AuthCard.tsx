import * as React from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck, Cpu, Code2, Video, CheckCircle2 } from "lucide-react";

interface AuthCardProps {
  title: string;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full rounded-3xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-200/50 overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-left relative">
      {/* Left Feature Hero Banner (Light Blue / Soft White Gradient) */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/40 border-r border-zinc-200/60 relative overflow-hidden">
        {/* Background ambient shine */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6 z-10">
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-zinc-900">
              Smart<span className="text-blue-600">Hire</span>
            </span>
          </Link>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Enterprise Talent Engine
            </span>
            <h3 className="text-2xl font-black text-zinc-900 leading-tight tracking-tight">
              AI-Powered Technical Evaluation Platform
            </h3>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">
              Seamlessly evaluate engineering candidates with automated ATS scoring, live coding sandboxes, and AI video scorecards.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { icon: Cpu, text: "AI Resume & ATS Match Scoring" },
              { icon: Code2, text: "Automated Coding IDE Sandbox" },
              { icon: Video, text: "Real-time AI Video Interview Scorecard" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-zinc-200/80 shadow-sm">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-800">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Badge */}
        <div className="pt-6 border-t border-zinc-200/80 z-10">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-[11px]">Empowering recruiters & candidate evaluation</span>
          </div>
        </div>
      </div>

      {/* Right Form Container (Clean Light White) */}
      <div className="col-span-1 lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-6 bg-white">
        {/* Mobile Header Logo */}
        <div className="flex lg:hidden items-center gap-2 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-zinc-900">
            Smart<span className="text-blue-600">Hire</span>
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{title}</h2>
          {subtitle && (
            <div className="text-xs text-zinc-500 font-medium leading-relaxed">
              {subtitle}
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
