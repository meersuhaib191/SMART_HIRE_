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
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="bg-[#030303] text-zinc-100 min-h-screen relative overflow-hidden font-sans antialiased selection:bg-blue-500/30 selection:text-white">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[600px] w-full max-w-7xl bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(59,130,246,0.18),rgba(255,255,255,0))]" />
      <div className="absolute top-[1800px] right-0 -z-10 h-[500px] w-[500px] bg-blue-900/10 blur-[150px] rounded-full animate-pulse-glow" />

      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HERO SECTION
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-16 md:pt-32 md:pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-950/20 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-400 backdrop-blur-sm animate-fade-in">
          <Sparkles className="h-3.5 w-3.5" /> Next-Generation AI Recruiting
        </div>

        <h1 className="mt-6 bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl md:text-7xl leading-tight">
          Hire Smarter, Faster,<br />and Without Bias
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 leading-relaxed">
          Smart Hire connects resume parsing, logical assessments, candidate scores, and interview panels scheduling in a single unified SaaS platform.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/register">
            <Button
              variant="primary"
              size="lg"
              className="bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 px-8"
            >
              Get Started Free
            </Button>
          </Link>
          <Link href="/contact">
            <Button
              variant="outline"
              size="lg"
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-900/50 hover:text-white px-8"
            >
              Book Live Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. TRUSTED BY COMPANIES
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-[#060608]/40 py-10">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Trusted by forward-thinking squads worldwide
          </p>
          <div className="mt-8 flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-40 grayscale contrast-200">
            <span className="text-xl font-bold tracking-tight text-zinc-300">ACME CORP</span>
            <span className="text-xl font-bold tracking-tight text-zinc-300">CLERK CO</span>
            <span className="text-xl font-bold tracking-tight text-zinc-300">VITE TECH</span>
            <span className="text-xl font-bold tracking-tight text-zinc-300">LINEAR LABS</span>
            <span className="text-xl font-bold tracking-tight text-zinc-300">ASHBY INC</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. FEATURE CARDS
          ───────────────────────────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Platform Features</h2>
          <p className="text-zinc-400">
            Automate screening, run coding evaluations, sync schedules, and review recruiter pipeline metrics in one place.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 space-y-4 hover:border-zinc-800 transition-all glow-glow">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500">
              <FileSearch className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">Resume Parsing</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Extract experience history and core candidate skills instantly from PDFs/docs with over 97% accuracy.
            </p>
          </div>
          {/* Card 2 */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 space-y-4 hover:border-zinc-800 transition-all glow-glow">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-500">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">AI Screening</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Compare resumes to job postings, calculate match scoring, and review anonymized fit summaries.
            </p>
          </div>
          {/* Card 3 */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 space-y-4 hover:border-zinc-800 transition-all glow-glow">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/10 text-purple-500">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">Smart Scheduling</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Coordinate panel availability, support candidate self-booking, and generate mock meet links automatically.
            </p>
          </div>
          {/* Card 4 */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 space-y-4 hover:border-zinc-800 transition-all glow-glow">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-500">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">Realtime Analytics</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Track conversion rates, time-to-hire pipelines, and recruiter throughput charts.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. HOW IT WORKS
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-28 border-t border-zinc-900/60 bg-[#060608]/20">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold sm:text-4xl">How It Works</h2>
          <p className="text-zinc-400">
            A frictionless candidate lifecycle built on microservices logic.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="space-y-4">
            <div className="text-5xl font-extrabold text-blue-600/20">01</div>
            <h3 className="text-xl font-bold text-zinc-150">Create & Publish</h3>
            <p className="text-zinc-450 text-sm leading-relaxed">
              Post job openings with customizable recruitment pipeline stages and assessment score thresholds.
            </p>
          </div>
          <div className="space-y-4">
            <div className="text-5xl font-extrabold text-indigo-600/20">02</div>
            <h3 className="text-xl font-bold text-zinc-150">AI Evaluation</h3>
            <p className="text-zinc-450 text-sm leading-relaxed">
              Applicants submit resumes. Our AI parser extracts skill sets and generates initial screening match scores.
            </p>
          </div>
          <div className="space-y-4">
            <div className="text-5xl font-extrabold text-purple-600/20">03</div>
            <h3 className="text-xl font-bold text-zinc-150">Panel Interview</h3>
            <p className="text-zinc-450 text-sm leading-relaxed">
              Candidates schedule via available calendar slots, complete panel scorecards, and finalize onboarding.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. AI RECRUITMENT FEATURE PREVIEW
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-28 border-t border-zinc-900/60">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full">
              <Zap className="h-3.5 w-3.5" /> Bias Mitigation Engine
            </div>
            <h2 className="text-3xl font-extrabold sm:text-4xl leading-tight">
              Anonymized Candidate Screening
            </h2>
            <p className="text-zinc-450 leading-relaxed">
              Smart Hire helps teams run objective candidate reviews. Recruiters can toggle anonymized screening mode to strip demographic details, names, locations, and institutions from resumes profiles during primary evaluations.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Encrypted demographic mappings</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Unbiased vector embedding matchups</span>
              </li>
            </ul>
            <div className="pt-4">
              <Link href="/features">
                <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-900">
                  Learn About Bias Controls
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-8 shadow-2xl backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-zinc-550 font-mono">anonymization-module.ts</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-zinc-950/80 p-4 border border-zinc-900">
                <div className="flex justify-between items-center text-xs text-zinc-500 mb-2">
                  <span>Anonymized Profile #SH-9831</span>
                  <span className="text-emerald-500 font-semibold font-mono">MATCH SCORE: 94%</span>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded bg-zinc-800" />
                  <div className="h-3 w-1/2 rounded bg-zinc-900" />
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-800 bg-zinc-900/20 text-xs">
                <span className="text-zinc-400">Candidate Name</span>
                <span className="text-zinc-600 italic">Hidden in Primary Screening</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-800 bg-zinc-900/20 text-xs">
                <span className="text-zinc-400">Gender & Demographics</span>
                <span className="text-zinc-600 italic">Redacted</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. PLATFORM MODULES OVERVIEW
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-28 border-t border-zinc-900/60 bg-[#060608]/10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Comprehensive Modules</h2>
          <p className="text-zinc-400">
            A unified suite designed for modern recruiting teams.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-3 hover:border-zinc-800 transition-colors">
            <Briefcase className="h-6 w-6 text-blue-500" />
            <h3 className="font-bold text-zinc-200">Jobs</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Create openings, publish to boards, and track pipelines.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-3 hover:border-zinc-800 transition-colors">
            <Users className="h-6 w-6 text-indigo-500" />
            <h3 className="font-bold text-zinc-200">Candidates</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Sync experiences, certificate records, and social details.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-3 hover:border-zinc-800 transition-colors">
            <ClipboardList className="h-6 w-6 text-purple-500" />
            <h3 className="font-bold text-zinc-200">Assessments</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Logical reasoning and coding challenges with auto-grading.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-3 hover:border-zinc-800 transition-colors">
            <CalendarDays className="h-6 w-6 text-pink-500" />
            <h3 className="font-bold text-zinc-200">Interviews</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Availability management, panels, and scorecards feedback.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-3 hover:border-zinc-800 transition-colors">
            <Activity className="h-6 w-6 text-emerald-500" />
            <h3 className="font-bold text-zinc-200">Analytics</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Time-to-hire matrices, funnel metrics, and performance charts.
            </p>
          </div>
        </div>
      </section>



      {/* ─────────────────────────────────────────────────────────────────────────────
          8. FAQ SECTION
          ───────────────────────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-7xl px-6 py-20 md:py-28 border-t border-zinc-900/60">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Frequently Asked Questions</h2>
          <p className="text-zinc-400">
            Got questions? We&apos;ve got answers.
          </p>
        </div>

        <FaqSection />
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. CALL-TO-ACTION BANNER
          ───────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-20 mb-20">
        <div className="relative rounded-3xl overflow-hidden border border-zinc-800 bg-gradient-to-r from-zinc-900 to-black p-8 md:p-16 text-center space-y-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent)]" />
          <h2 className="text-3xl font-extrabold sm:text-5xl text-white">
            Ready to scale your recruiting?
          </h2>
          <p className="mx-auto max-w-xl text-zinc-450 text-sm md:text-base leading-relaxed">
            Create an organization workspace today and invite your team. Automate interview coordination and screening instantly.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-4 relative z-10">
            <Link href="/register">
              <Button variant="primary" size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8 flex items-center gap-1.5">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 px-8">
                Talk to Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
