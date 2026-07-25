import * as React from "react";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { FaqSection } from "@/components/marketing/Faq";

import {
  BrainCircuit,
  FileSearch,
  CalendarDays,
  Activity,
  Briefcase,
  Users,
  ClipboardList,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Code2,
  CheckCircle2,
  BarChart3
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen relative overflow-hidden font-sans antialiased selection:bg-blue-500/20 selection:text-blue-900">
      {/* Subtle Light Radial Glow Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[600px] w-full max-w-7xl bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(59,130,246,0.12),rgba(255,255,255,0))]" />
      <div className="absolute top-[1800px] right-0 -z-10 h-[500px] w-[500px] bg-blue-100/60 blur-[140px] rounded-full" />

      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HERO SECTION
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-xs font-bold text-blue-700 shadow-sm animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Next-Generation AI Recruitment & Assessment Platform
        </div>

        <h1 className="mt-6 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl md:text-7xl leading-tight">
          Hire Top Talent,<br />Smarter & Faster
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-slate-600 font-medium leading-relaxed">
          SmartHire unifies AI ATS resume screening, interactive MCQ assessments, Monaco-based coding challenges, and AI interview evaluations in one seamless platform.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/register">
            <Button
              variant="primary"
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/25 px-8 py-3.5 rounded-xl cursor-pointer"
            >
              Get Started Free <ArrowRight className="h-4 w-4 ml-1 inline" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              size="lg"
              className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-extrabold px-8 py-3.5 rounded-xl cursor-pointer"
            >
              Sign In to Portal
            </Button>
          </Link>
        </div>

        {/* Hero Preview Card */}
        <div className="mt-16 mx-auto max-w-5xl bg-white border border-slate-200/80 rounded-3xl shadow-2xl p-4 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <span className="text-xs font-bold text-slate-500">SmartHire Talent Pipeline Console</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Job Candidates</span>
              <span className="text-2xl font-black text-slate-900">1,480</span>
            </div>
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100">
              <span className="text-[10px] font-bold text-blue-600 uppercase block">ATS Match Rate</span>
              <span className="text-2xl font-black text-blue-700">94.2%</span>
            </div>
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase block">MCQ & IDE Passed</span>
              <span className="text-2xl font-black text-indigo-700">892</span>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-600 uppercase block">Offers Extended</span>
              <span className="text-2xl font-black text-emerald-700">142</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. TRUSTED LOGOS
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Trusted by modern corporate hiring teams worldwide
          </p>
          <div className="mt-8 flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-60 grayscale">
            <span className="text-lg font-black tracking-tight text-slate-700">ACME CORP</span>
            <span className="text-lg font-black tracking-tight text-slate-700">CLERK CO</span>
            <span className="text-lg font-black tracking-tight text-slate-700">VITE TECH</span>
            <span className="text-lg font-black tracking-tight text-slate-700">LINEAR LABS</span>
            <span className="text-lg font-black tracking-tight text-slate-700">ASHBY INC</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. FEATURE CARDS
          ───────────────────────────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-extrabold text-blue-600 uppercase tracking-widest block">Comprehensive Ecosystem</span>
          <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">Everything You Need for Talent Evaluation</h2>
          <p className="text-slate-600 font-medium">
            Automate ATS screening, execute multi-language coding assessments in Monaco IDE, schedule interviews, and track candidate growth.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {/* Card 1 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <FileSearch className="h-5 w-5" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">AI ATS Match Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Parse PDFs, Word docs, and JSON resumes against target job descriptions with multi-factor semantic skill gap analysis.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Deterministic MCQ Exams</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Administer recruiter-uploaded JSON question banks with server-side answer keys and single source-of-truth score persistence.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <Code2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Monaco Coding Sandbox</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Run Code & Submit solutions in Python, C++, Java, C#, and JavaScript with hidden test case evaluation and AI code reviews.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Kanban & Analytics</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Track candidates across 7 recruitment funnel stages, review growth velocity charts, and issue automated offer letters.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. CTA SECTION
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-10 md:p-16 text-white text-center shadow-xl space-y-6">
          <h2 className="text-3xl font-black sm:text-4xl">Ready to Transform Your Hiring Workflow?</h2>
          <p className="max-w-2xl mx-auto text-blue-100 text-sm md:text-base font-medium">
            Join corporate hiring managers and candidate job seekers already using SmartHire today.
          </p>
          <div className="pt-2">
            <Link href="/register">
              <Button
                variant="primary"
                size="lg"
                className="bg-white text-blue-700 hover:bg-slate-100 font-extrabold px-8 py-3.5 rounded-xl cursor-pointer shadow-lg"
              >
                Create Account Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />
    </div>
  );
}
