"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckSquare, Sparkles, Loader2, Building2, UserCheck, Layers, Mail, Globe, MapPin, Phone, ArrowRight } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

interface JobDetails {
  id: string;
  title: string;
  description: string;
  category?: string;
  location?: string;
  type: string;
  status: string;
  salary_min?: number;
  salary_max?: number;
  experience_level: string;
  recruiter_id: string;
  company_id?: string;
  created_at: string;
}

export default function JobOverviewPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<JobDetails | null>(null);
  const [applicantCount, setApplicantCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  // Recruiter & Employer Profile Specs State
  const [recruiterSpecs, setRecruiterSpecs] = React.useState({
    name: "Recruiter Lead",
    title: "Talent Acquisition Lead",
    email: "",
    phone: "",
    avatar: "",
  });

  const [companySpecs, setCompanySpecs] = React.useState({
    name: "Company Workspace",
    domain: "",
    industry: "Technology",
    location: "Remote",
    description: "",
  });

  React.useEffect(() => {
    const loadDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const first = user.user_metadata?.first_name || user.email?.split("@")[0] || "";
          const last = user.user_metadata?.last_name || "";
          setRecruiterSpecs((prev) => ({
            ...prev,
            name: `${first} ${last}`.trim() || "Recruiter Lead",
            email: user.email || "",
          }));

          const savedProfileKey = `smarthire_active_recruiter_profile_${user.id}`;
          const savedProfile = localStorage.getItem(savedProfileKey) || localStorage.getItem("smarthire_active_recruiter_profile");
          if (savedProfile) {
            try {
              const parsed = JSON.parse(savedProfile);
              setRecruiterSpecs({
                name: `${parsed.recruiterFirstName || first} ${parsed.recruiterLastName || last}`.trim() || "Recruiter Lead",
                title: parsed.recruiterTitle || "Talent Acquisition Lead",
                email: parsed.recruiterEmail || user.email || "",
                phone: parsed.recruiterPhone || "",
                avatar: parsed.recruiterAvatar || "",
              });
              setCompanySpecs({
                name: parsed.companyName || "Company Workspace",
                domain: parsed.companyDomain || "",
                industry: parsed.companyIndustry || "Technology",
                location: parsed.companyLocation || "Remote",
                description: parsed.companyDescription || "",
              });
            } catch (e) {
              logger.error("Failed to parse saved profile specs", e);
            }
          }

          // Also query DB for recruiter's company
          const { data: recruiter } = await supabase
            .schema("organization")
            .from("recruiters")
            .select("company_id, title")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .maybeSingle();

          if (recruiter?.company_id) {
            const { data: comp } = await supabase
              .schema("organization")
              .from("companies")
              .select("name, domain, industry, location, description")
              .eq("id", recruiter.company_id)
              .maybeSingle();

            if (comp) {
              setCompanySpecs({
                name: comp.name || "Company Workspace",
                domain: comp.domain || "",
                industry: comp.industry || "Technology",
                location: comp.location || "Remote",
                description: comp.description || "",
              });
            }
          }
        }

        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Failed to load details");
        const { data } = await res.json();
        setJob(data);

        // Fetch application count
        const { count } = await supabase
          .schema("application")
          .from("job_applications")
          .select("*", { count: "exact", head: true })
          .eq("job_id", jobId);

        if (count !== null) setApplicantCount(count);
      } catch (err) {
        logger.error("Failed to load overview data", err);
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-in fade-in duration-200">
      {/* Left Column: Job Description and Specs */}
      <div className="lg:col-span-8 space-y-6">
        {/* Description Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="text-base font-extrabold text-zinc-900">Description & Job Requirements</h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
              {job.category || "Technology"}
            </span>
          </div>
          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line font-normal">
            {job.description}
          </p>
        </div>

        {/* Recruitment Pipeline Performance & Quick Actions */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-7 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-100 pb-4">
            <div>
              <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest block">Candidate Funnel</span>
              <h3 className="text-lg font-extrabold text-zinc-900">Kanban Assessment Funnel</h3>
            </div>
            <Link
              href={`/recruiter/jobs/${jobId}/applications`}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
            >
              <Layers className="h-4 w-4" /> Open Kanban Board <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-blue-100 shadow-sm text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total Applications</span>
              <span className="text-2xl font-black text-blue-600 mt-1 block">{applicantCount}</span>
            </div>
            <div className="p-4 rounded-xl bg-white border border-blue-100 shadow-sm text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Active Screener</span>
              <span className="text-2xl font-black text-indigo-600 mt-1 block">10 Stages</span>
            </div>
            <div className="p-4 rounded-xl bg-white border border-blue-100 shadow-sm text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Status</span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mt-2 inline-block capitalize">
                {job.status}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline milestones */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h3 className="text-base font-extrabold text-zinc-900 mb-5">Job Lifecycle Timeline</h3>
          <div className="relative border-l-2 border-zinc-100 pl-6 space-y-6 text-sm">
            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-white">
                <CheckSquare className="h-2.5 w-2.5" />
              </span>
              <p className="font-bold text-zinc-900">Job Opening Published</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Created on {new Date(job.created_at).toLocaleDateString()} by Lead Recruiter ({recruiterSpecs.name})
              </p>
            </div>
            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-blue-600 text-white ring-4 ring-white">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
              <p className="font-bold text-zinc-900">AI Screening Funnel Active</p>
              <p className="text-xs text-zinc-500 mt-0.5">Automated ATS, MCQ, and AI Code Proctoring enabled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Hiring Team & Specifications Metadata */}
      <div className="lg:col-span-4 space-y-6">
        {/* LEAD RECRUITER CARD */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <UserCheck className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-extrabold text-zinc-900">Assigned Lead Recruiter</h3>
          </div>

          <div className="flex items-center gap-4">
            {recruiterSpecs.avatar ? (
              <img
                src={recruiterSpecs.avatar}
                alt={recruiterSpecs.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/20 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg flex items-center justify-center shadow-md shrink-0">
                {recruiterSpecs.name.charAt(0)}
              </div>
            )}
            <div className="space-y-0.5 overflow-hidden">
              <h4 className="text-sm font-black text-zinc-900 truncate">{recruiterSpecs.name}</h4>
              <p className="text-xs font-bold text-blue-600 truncate">{recruiterSpecs.title}</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100 text-xs">
            <div className="flex items-center gap-2 text-zinc-600">
              <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="truncate font-medium">{recruiterSpecs.email}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="font-medium">{recruiterSpecs.phone}</span>
            </div>
          </div>
        </div>

        {/* HIRING EMPLOYER SPECS CARD */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-extrabold text-zinc-900">Hiring Employer Credentials</h3>
          </div>

          <div className="space-y-2">
            <h4 className="text-base font-black text-zinc-900">{companySpecs.name}</h4>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <a href={`https://${companySpecs.domain}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {companySpecs.domain}
              </a>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span>{companySpecs.location}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
            {companySpecs.description}
          </p>
        </div>

        {/* Job Metadata Specifications Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-zinc-900 border-b border-zinc-100 pb-3">
            Job Metadata & Compensation
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Employment Type</span>
              <span className="font-bold text-zinc-900 capitalize">{job.type.replace("-", " ")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Experience Level</span>
              <span className="font-bold text-zinc-900 capitalize">{job.experience_level}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Salary Range</span>
              <span className="font-bold text-blue-600">
                {job.salary_min ? `$${job.salary_min.toLocaleString()} - $${job.salary_max?.toLocaleString()}` : "Undisclosed"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
