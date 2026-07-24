"use client";

import * as React from "react";
import { ApplicationCard, CandidateDrawer, PipelineFilters, MetricsBar, CandidateAppCard } from "@/components/pipeline";
import { logger } from "@smarthire/logger";
import { SkeletonMetric, SkeletonCard } from "@/components/shared/Skeleton";
import { CheckCircle2, ChevronRight, Loader2, Briefcase, Video, UserCheck, Calendar, Clock, UploadCloud, FileText, X, FileCheck, Sparkles } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

const techColumns = [
  { key: "applied", name: "1. Applied" },
  { key: "screening", name: "2. ATS Screened" },
  { key: "mcq", name: "3. MCQ Exam" },
  { key: "coding", name: "4. IDE Coding Round" },
  { key: "interview", name: "5. AI Interview" },
  { key: "zoom_interview", name: "6. Recruiter Google Meet" },
  { key: "offer_sent", name: "7. Offer Sent & Joined" },
];

const nonTechColumns = [
  { key: "applied", name: "1. Applied" },
  { key: "screening", name: "2. ATS Screened" },
  { key: "mcq", name: "3. MCQ Exam" },
  { key: "interview", name: "4. AI Interview" },
  { key: "zoom_interview", name: "5. Recruiter Google Meet" },
  { key: "offer_sent", name: "6. Offer Sent & Joined" },
];

function PdfUploader({
  label,
  description,
  file,
  onFileChange,
  required = false,
}: {
  label: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  required?: boolean;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 transition-all">
        {file ? (
          <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-blue-200 text-xs shadow-sm">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold border border-blue-100">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-zinc-900 truncate">{file.name}</span>
                  <FileCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                </div>
                <span className="text-[10px] text-zinc-500 font-medium block">{(file.size / 1024).toFixed(1)} KB • PDF Template Ready</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="text-zinc-400 hover:text-red-500 text-xs font-bold px-2 py-1 rounded hover:bg-zinc-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-xl p-4 cursor-pointer transition-all text-center group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) onFileChange(selected);
              }}
            />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-500 group-hover:text-blue-600 group-hover:border-blue-200 transition-all mb-2">
              <UploadCloud className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-zinc-800 group-hover:text-blue-600 transition-colors">
              Click or drag PDF template here
            </span>
            <span className="text-[10px] text-zinc-500 mt-0.5">{description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatErrorMessage(errData: unknown, fallback: string): string {
  if (!errData) return fallback;
  if (typeof errData === "string") return errData;
  if (typeof errData === "object" && errData !== null) {
    const obj = errData as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.error === "object" && obj.error !== null) {
      const sub = obj.error as Record<string, unknown>;
      if (typeof sub.message === "string") return sub.message;
      return JSON.stringify(sub);
    }
    return JSON.stringify(obj);
  }
  return String(errData);
}

export default function PipelinePage() {
  const [cards, setCards] = React.useState<CandidateAppCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedJobId, setSelectedJobId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [jobs, setJobs] = React.useState<{ id: string; title: string }[]>([]);

  // Drawer detail state
  const [activeCard, setActiveCard] = React.useState<CandidateAppCard | null>(null);
  const [screeningLoading, setScreeningLoading] = React.useState(false);
  const [topNLimit, setTopNLimit] = React.useState(30);

  // MCQ scheduling state
  // Active job and company profile state
  const [activeJobDetails, setActiveJobDetails] = React.useState<{
    id: string;
    title: string;
    company_id?: string | null;
    location?: string | null;
    category?: string | null;
    salary_min?: number | null;
    salary_max?: number | null;
    mcq_assessment_id: string | null;
    mcq_scheduled_start_at: string | null;
    coding_assessment_id?: string | null;
    coding_scheduled_start_at?: string | null;
  } | null>(null);

  const [companyDetails, setCompanyDetails] = React.useState<{
    id: string;
    name: string;
    industry?: string | null;
  } | null>(null);

  // MCQ scheduling state
  const [mcqModalOpen, setMcqModalOpen] = React.useState(false);
  const [mcqScheduleTime, setMcqScheduleTime] = React.useState("");
  const [mcqPdfFile, setMcqPdfFile] = React.useState<File | null>(null);
  const [mcqSubmitting, setMcqSubmitting] = React.useState(false);

  // Coding scheduling state
  const [codingModalOpen, setCodingModalOpen] = React.useState(false);
  const [codingScheduleTime, setCodingScheduleTime] = React.useState("");
  const [codingPdfFile, setCodingPdfFile] = React.useState<File | null>(null);
  const [codingSubmitting, setCodingSubmitting] = React.useState(false);

  // Interview scheduling state
  const [interviewModalOpen, setInterviewModalOpen] = React.useState(false);
  const [selectedInterviewType, setSelectedInterviewType] = React.useState<"ai_interview" | "zoom_interview">("ai_interview");
  const [interviewCard, setInterviewCard] = React.useState<CandidateAppCard | null>(null);
  const [interviewDateTime, setInterviewDateTime] = React.useState("");
  const [interviewDuration, setInterviewDuration] = React.useState("60");
  const [interviewerName, setInterviewerName] = React.useState("");
  const [interviewerEmail, setInterviewerEmail] = React.useState("");
  const [meetingLink, setMeetingLink] = React.useState("");
  const [interviewNotes, setInterviewNotes] = React.useState("");
  const [interviewPdfFile, setInterviewPdfFile] = React.useState<File | null>(null);
  const [interviewSubmitting, setInterviewSubmitting] = React.useState(false);

  // Offer Letter Generation State
  const [offerModalCard, setOfferModalCard] = React.useState<CandidateAppCard | null>(null);
  const [offerCompanyName, setOfferCompanyName] = React.useState("Waadi Media");
  const [offerCompanyDivision, setOfferCompanyDivision] = React.useState("Corporate HR & Talent Acquisition Division");
  const [offerSalary, setOfferSalary] = React.useState("$120,000 / annum");
  const [offerJoiningDate, setOfferJoiningDate] = React.useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [offerLocation, setOfferLocation] = React.useState("San Francisco, CA / Remote");
  const [offerSending, setOfferSending] = React.useState(false);

  const openOfferModalFor = React.useCallback(
    (card: CandidateAppCard) => {
      setOfferModalCard(card);
      if (companyDetails?.name) {
        setOfferCompanyName(companyDetails.name);
      }
      if (activeJobDetails?.category || companyDetails?.industry) {
        setOfferCompanyDivision(`${activeJobDetails?.category || companyDetails?.industry} Division`);
      }
      if (activeJobDetails?.location) {
        setOfferLocation(activeJobDetails.location);
      }
      if (activeJobDetails?.salary_min && activeJobDetails?.salary_max) {
        setOfferSalary(`$${Number(activeJobDetails.salary_min).toLocaleString()} - $${Number(activeJobDetails.salary_max).toLocaleString()} / annum`);
      } else if (activeJobDetails?.salary_min) {
        setOfferSalary(`$${Number(activeJobDetails.salary_min).toLocaleString()} / annum`);
      }
    },
    [companyDetails, activeJobDetails]
  );

  const getDefaultDatetimeLocal = React.useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    return new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const handleRejectCandidate = React.useCallback(
    async (card: CandidateAppCard, currentStageKey: string) => {
      if (!confirm(`Reject candidate ${card.candidate_name} at ${currentStageKey.toUpperCase()} round?`)) {
        return;
      }
      const previousCards = [...cards];
      setCards((prev) =>
        prev.map((c) =>
          c.id === card.id ? { ...c, status: "rejected", rejection_stage: currentStageKey } : c
        )
      );
      try {
        const res = await fetch(`/api/applications/${card.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected", rejection_stage: currentStageKey }),
        });
        if (!res.ok) throw new Error("Failed to update rejection status");
        logger.info(`[PipelinePage] Application ${card.id} rejected at stage ${currentStageKey}`);
      } catch (err) {
        logger.error("Failed to reject candidate, rolling back UI", err);
        setCards(previousCards);
      }
    },
    [cards]
  );

  const handleReinstateCandidate = React.useCallback(
    async (card: CandidateAppCard, stageKey: string) => {
      const previousCards = [...cards];
      setCards((prev) =>
        prev.map((c) =>
          c.id === card.id ? { ...c, status: stageKey, rejection_stage: null } : c
        )
      );
      try {
        const res = await fetch(`/api/applications/${card.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: stageKey, rejection_stage: null }),
        });
        if (!res.ok) throw new Error("Failed to reinstate candidate");
        logger.info(`[PipelinePage] Application ${card.id} reinstated to stage ${stageKey}`);
      } catch (err) {
        logger.error("Failed to reinstate candidate, rolling back UI", err);
        setCards(previousCards);
      }
    },
    [cards]
  );

  const fetchPipelineData = React.useCallback(async () => {
    if (!selectedJobId) {
      setCards([]);
      setLoading(false);
      setActiveJobDetails(null);
      return;
    }
    setLoading(true);
    try {
      // Fetch active job details and company profile
      const { data: jobData } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, title, company_id, location, category, salary_min, salary_max, mcq_assessment_id, mcq_scheduled_start_at, coding_assessment_id, coding_scheduled_start_at")
        .eq("id", selectedJobId)
        .single();
      
      if (jobData) {
        setActiveJobDetails(jobData);
        if (jobData.company_id) {
          const { data: compData } = await supabase
            .schema("organization")
            .from("companies")
            .select("id, name, industry")
            .eq("id", jobData.company_id)
            .maybeSingle();

          if (compData) {
            setCompanyDetails(compData);
          }
        }
      }

      // 1. Fetch all active applications from application schema
      const params = new URLSearchParams();
      params.append("jobId", selectedJobId);

      const appRes = await fetch(`/api/applications?${params.toString()}`);
      const resJson = await appRes.json().catch(() => ({}));
      const appsList = resJson.data || [];

      interface AppItem {
        id: string;
        candidate_id: string;
        job_id: string;
        status: string;
        rejection_stage?: string | null;
        created_at: string;
        score?: number | null;
        screening_score?: number | null;
        mcq_score?: number | null;
        mcq_total?: number | null;
        mcq_passed?: boolean | null;
        coding_score?: number | null;
        coding_total?: number | null;
        coding_passed?: boolean | null;
        interview_avg_score?: number | null;
        interview_recommendation?: string | null;
      }
      
      const rawApps: AppItem[] = appsList || [];

      if (rawApps.length > 0) {
        // 2. Fetch all candidates profiles linked
        const candidateIds = rawApps.map((a) => a.candidate_id);
        const { data: candidates } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id, first_name, last_name, email, headline, tags")
          .in("id", candidateIds);

        // 3. Fetch related jobs list titles
        const jobIds = rawApps.map((a) => a.job_id);
        const { data: jobsList } = await supabase
          .schema("job")
          .from("jobs")
          .select("id, title")
          .in("id", jobIds);

        // 4. Map everything to pipeline card interfaces
        const mappedCards: CandidateAppCard[] = rawApps.map((app) => {
          const cand = (candidates || []).find((c) => c.id === app.candidate_id);
          const job = (jobsList || []).find((j) => j.id === app.job_id);

          // Generate a mock priority for display variety
          const hashVal = app.id.charCodeAt(0) + app.id.charCodeAt(1);
          const priorityVal = hashVal % 3 === 0 ? "high" : hashVal % 3 === 1 ? "medium" : "low";

          return {
            id: app.id,
            candidate_id: app.candidate_id,
            candidate_name: cand ? `${cand.first_name} ${cand.last_name}` : "Jane Doe",
            candidate_email: cand?.email || "",
            headline: cand?.headline || "Applicant",
            job_title: job ? job.title : "Position",
            status: app.status,
            rejection_stage: app.rejection_stage,
            created_at: app.created_at,
            score: app.score ? Number(app.score) : undefined,
            tags: cand?.tags || [],
            priority: priorityVal as "high" | "medium" | "low",
            // Stage-specific scores
            screening_score: app.screening_score != null ? Number(app.screening_score) : undefined,
            mcq_score: app.mcq_score != null ? Number(app.mcq_score) : undefined,
            mcq_total: app.mcq_total != null ? Number(app.mcq_total) : undefined,
            mcq_passed: app.mcq_passed ?? undefined,
            coding_score: app.coding_score != null ? Number(app.coding_score) : undefined,
            coding_total: app.coding_total != null ? Number(app.coding_total) : undefined,
            coding_passed: app.coding_passed ?? undefined,
            interview_avg_score: app.interview_avg_score != null ? Number(app.interview_avg_score) : undefined,
            interview_recommendation: app.interview_recommendation ?? undefined,
          };
        });

        // Apply client side search & tag filtering
        let filtered = mappedCards;
        if (search) {
          const query = search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.candidate_name.toLowerCase().includes(query) ||
              c.candidate_email.toLowerCase().includes(query)
          );
        }

        if (tag) {
          const tagQuery = tag.toLowerCase();
          filtered = filtered.filter((c) =>
            (c.tags || []).some((t) => t.toLowerCase().includes(tagQuery))
          );
        }

        setCards(filtered);
      } else {
        setCards([]);
      }
    } catch (err) {
      logger.error("Failed to load pipeline board", err);
    } finally {
      setLoading(false);
    }
  }, [selectedJobId, search, tag]);

  // Load jobs list options for the logged-in recruiter's company
  React.useEffect(() => {
    const loadJobsList = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let query = supabase
          .schema("job")
          .from("jobs")
          .select("id, title, created_at, company_id")
          .is("deleted_at", null);

        if (user) {
          const { data: recruiter } = await supabase
            .schema("organization")
            .from("recruiters")
            .select("company_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (recruiter?.company_id) {
            query = query.eq("company_id", recruiter.company_id);
          }
        }

        const { data } = await query.order("created_at", { ascending: false });

        setJobs(data || []);
        if (data && data.length > 0) {
          setSelectedJobId((prev) => prev || data[0].id);
        } else {
          setSelectedJobId("");
        }
      } catch (err) {
        logger.error("Failed to fetch jobs options", err);
      }
    };
    loadJobsList();
  }, []);

  React.useEffect(() => {
    fetchPipelineData();
  }, [fetchPipelineData]);

  const getCanonicalStageKey = (status: string): string => {
    const s = (status || "").toLowerCase().trim();
    if (s === "applied") return "applied";
    if (s === "screening" || s === "ats_screened") return "screening";
    if (s === "mcq" || s === "mcq_exam") return "mcq";
    if (s === "coding" || s === "ide_coding") return "coding";
    if (s === "interview" || s === "ai_interview" || s === "ai_room") return "interview";
    if (s === "zoom_interview" || s === "recruiter_review" || s === "interview_scheduled" || s === "final_interview") return "zoom_interview";
    if (s === "offer_sent" || s === "offered" || s === "offer_accepted" || s === "joined") return "offer_sent";
    return s;
  };

  // Drag & Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData("text/plain");
    if (!appId) return;

    const draggedCard = cards.find((c) => c.id === appId);
    if (!draggedCard || draggedCard.status === targetStatus) return;

    // Strict Sequential Pipeline Stages Guard
    const isTechJob = !activeJobDetails ||
      activeJobDetails.title?.toLowerCase().includes("engineer") ||
      activeJobDetails.title?.toLowerCase().includes("developer") ||
      activeJobDetails.title?.toLowerCase().includes("tech") ||
      activeJobDetails.title?.toLowerCase().includes("full stack") ||
      activeJobDetails.title?.toLowerCase().includes("software");

    const activeColumns = isTechJob ? techColumns : nonTechColumns;
    const activeKeys = activeColumns.map((c) => c.key);

    const currentIdx = activeKeys.indexOf(getCanonicalStageKey(draggedCard.status));
    const targetIdx = activeKeys.indexOf(getCanonicalStageKey(targetStatus));

    // Prevent non-sequential skipping or jumping rounds to eliminate recruiter bias
    if (currentIdx !== -1 && targetIdx !== -1 && targetIdx > currentIdx + 1) {
      alert(
        `⚠️ Objective Pipeline Guard & Bias Prevention\n\n` +
        `Candidates must advance sequentially through each evaluation round.\n` +
        `Skipping rounds (e.g. jumping directly from '${draggedCard.status}' to '${targetStatus}') is prohibited.\n\n` +
        `Please move candidates step-by-step or click the 'Advance' button on the candidate card.`
      );
      return;
    }

    // Trigger Custom Editable Offer Letter Modal if target is offer_sent / offered
    if (targetStatus === "offer_sent" || targetStatus === "offered") {
      openOfferModalFor(draggedCard);
      return;
    }

    // Trigger Google Meet Scheduling Modal ONLY if target is zoom_interview
    if (targetStatus === "zoom_interview") {
      setInterviewCard(draggedCard);
      setInterviewDateTime(
        draggedCard.interview_scheduled_at
          ? new Date(new Date(draggedCard.interview_scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : getDefaultDatetimeLocal()
      );
      if (!meetingLink) {
        const code = `smh-${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}`;
        setMeetingLink(`https://meet.google.com/${code}`);
      }
      setInterviewModalOpen(true);
      return;
    }

    // Save previous state for rollback on error
    const previousCards = [...cards];

    // Optimistic UI update
    setCards((prev) =>
      prev.map((c) => (c.id === appId ? { ...c, status: targetStatus } : c))
    );

    try {
      // Trigger database status PATCH update
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = formatErrorMessage(errJson, `Status transition API rejected drop with HTTP ${res.status}`);
        logger.error(`[PipelinePage] Status transition rejected: ${msg}`);
        alert(`⚠️ Pipeline Transition Alert: ${msg}`);
        setCards(previousCards);
        return;
      }
      logger.info(`[PipelinePage] Application ${appId} dragged to stage: ${targetStatus}`);
      await fetchPipelineData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : formatErrorMessage(err, "Drag and drop transition failed");
      logger.error("Drag and drop transition failed, rolling back UI", err);
      alert(`⚠️ Pipeline Transition Alert: ${msg}`);
      setCards(previousCards);
    }
  };

  const handleAdvanceSingleCandidate = async (card: CandidateAppCard) => {
    const isTechJob = !activeJobDetails ||
      activeJobDetails.title?.toLowerCase().includes("engineer") ||
      activeJobDetails.title?.toLowerCase().includes("developer") ||
      activeJobDetails.title?.toLowerCase().includes("tech") ||
      activeJobDetails.title?.toLowerCase().includes("full stack") ||
      activeJobDetails.title?.toLowerCase().includes("software");

    const activeCols = isTechJob ? techColumns : nonTechColumns;
    const activeKeys = activeCols.map((c) => c.key);
    const canonicalStatus = getCanonicalStageKey(card.status);
    const currentIdx = activeKeys.indexOf(canonicalStatus);

    if (currentIdx === -1 || currentIdx >= activeKeys.length - 1) return;
    const nextKey = activeKeys[currentIdx + 1];

    if (nextKey === "offer_sent" || nextKey === "offered") {
      openOfferModalFor(card);
      return;
    }

    if (nextKey === "zoom_interview") {
      setInterviewCard(card);
      setInterviewDateTime(
        card.interview_scheduled_at
          ? new Date(new Date(card.interview_scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : getDefaultDatetimeLocal()
      );
      if (!meetingLink) {
        const code = `smh-${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}`;
        setMeetingLink(`https://meet.google.com/${code}`);
      }
      setInterviewModalOpen(true);
      return;
    }

    const previousCards = [...cards];
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, status: nextKey } : c)));

    try {
      const res = await fetch(`/api/applications/${card.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextKey }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = formatErrorMessage(errJson, `Status update rejected with HTTP ${res.status}`);
        logger.error(`[PipelinePage] Status update rejected: ${msg}`);
        alert(`⚠️ Pipeline Transition Alert: ${msg}`);
        setCards(previousCards);
        return;
      }
      logger.info(`[PipelinePage] Application ${card.id} advanced to stage: ${nextKey}`);
      await fetchPipelineData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : formatErrorMessage(err, "Failed to advance candidate status");
      logger.error("Failed to advance candidate status", err);
      alert(`⚠️ Stage Transition Alert: ${msg}`);
      setCards(previousCards);
    }
  };

  const handleAdvanceAll = async (currentStatus: string) => {
    const isTechJob = !activeJobDetails ||
      activeJobDetails.title?.toLowerCase().includes("engineer") ||
      activeJobDetails.title?.toLowerCase().includes("developer") ||
      activeJobDetails.title?.toLowerCase().includes("tech") ||
      activeJobDetails.title?.toLowerCase().includes("full stack") ||
      activeJobDetails.title?.toLowerCase().includes("software");

    const activeCols = isTechJob ? techColumns : nonTechColumns;
    const activeKeys = activeCols.map((c) => c.key);
    const currentIndex = activeKeys.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= activeKeys.length - 1) return;

    const nextStatus = activeKeys[currentIndex + 1];
    const targetCards = cards.filter((c) => c.status === currentStatus);
    if (targetCards.length === 0) return;

    const previousCards = [...cards];

    // Optimistically update all matching cards in state
    setCards((prev) =>
      prev.map((c) => (c.status === currentStatus ? { ...c, status: nextStatus } : c))
    );

    try {
      const updatePromises = targetCards.map((card) =>
        fetch(`/api/applications/${card.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        })
      );

      const results = await Promise.all(updatePromises);
      const failed = results.some((res) => !res.ok);
      if (failed) throw new Error();
      logger.info(`[PipelinePage] Batch advanced ${targetCards.length} candidates from ${currentStatus} to ${nextStatus}`);
    } catch (err) {
      logger.error("Batch status transition failed, rolling back UI", err);
      setCards(previousCards);
    }
  };

  const handleAdvanceTopN = async (fromStage: string, count: number) => {
    const isTechJob = !activeJobDetails ||
      activeJobDetails.title?.toLowerCase().includes("engineer") ||
      activeJobDetails.title?.toLowerCase().includes("developer") ||
      activeJobDetails.title?.toLowerCase().includes("tech") ||
      activeJobDetails.title?.toLowerCase().includes("full stack") ||
      activeJobDetails.title?.toLowerCase().includes("software");

    const activeCols = isTechJob ? techColumns : nonTechColumns;
    const activeKeys = activeCols.map((c) => c.key);
    const currentIdx = activeKeys.indexOf(fromStage);
    if (currentIdx === -1 || currentIdx >= activeKeys.length - 1) return;

    const toStage = activeKeys[currentIdx + 1];

    let stageCards = cards.filter((c) => c.status === fromStage);

    // Sort by stage-appropriate objective score (highest score first)
    if (fromStage === "screening") {
      stageCards.sort((a, b) => (b.screening_score || b.score || 0) - (a.screening_score || a.score || 0));
    } else if (fromStage === "mcq") {
      stageCards.sort((a, b) => (b.mcq_score || 0) - (a.mcq_score || 0));
    } else if (fromStage === "coding") {
      stageCards.sort((a, b) => (b.coding_score || 0) - (a.coding_score || 0));
    } else if (fromStage === "interview") {
      stageCards.sort((a, b) => (b.interview_avg_score || 0) - (a.interview_avg_score || 0));
    } else {
      stageCards.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    const targetCards = stageCards.slice(0, count);
    if (targetCards.length === 0) return;

    if (toStage === "offer_sent") {
      setOfferModalCard(targetCards[0]);
      return;
    }

    const previousCards = [...cards];

    // Optimistic UI update
    setCards((prev) =>
      prev.map((c) =>
        targetCards.some((tc) => tc.id === c.id) ? { ...c, status: toStage } : c
      )
    );

    try {
      const updatePromises = targetCards.map((card) =>
        fetch(`/api/applications/${card.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: toStage }),
        })
      );

      const results = await Promise.all(updatePromises);
      const failed = results.some((res) => !res.ok);
      if (failed) throw new Error();
      logger.info(`[PipelinePage] Objective Top N advanced ${targetCards.length} candidates from ${fromStage} to ${toStage}`);
    } catch (err) {
      logger.error("Top N advancement failed, rolling back UI", err);
      setCards(previousCards);
    }
  };

  const handleStartATSScreening = async () => {
    if (!selectedJobId) return;
    setScreeningLoading(true);
    try {
      const res = await fetch("/api/applications/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });
      if (!res.ok) throw new Error("ATS screening failed");
      await fetchPipelineData();
    } catch (err) {
      logger.error("ATS Screening failed to run", err);
    } finally {
      setScreeningLoading(false);
    }
  };

  const handleSaveMCQSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !mcqScheduleTime) return;

    setMcqSubmitting(true);
    try {
      const res = await fetch(`/api/recruiter/jobs/${selectedJobId}/schedule-mcq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledTime: new Date(mcqScheduleTime).toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save MCQ schedule");

      setMcqModalOpen(false);
      await fetchPipelineData();
    } catch (err) {
      logger.error("Failed to save MCQ exam schedule", err);
    } finally {
      setMcqSubmitting(false);
    }
  };

  const handleSaveCodingSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !codingScheduleTime) return;

    setCodingSubmitting(true);
    try {
      const res = await fetch(`/api/recruiter/jobs/${selectedJobId}/schedule-coding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledTime: new Date(codingScheduleTime).toISOString(),
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || resData.message || "Failed to save Coding round schedule");
      }

      setCodingModalOpen(false);
      await fetchPipelineData();
    } catch (err: unknown) {
      logger.error("Failed to save Coding round schedule", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Scheduling Error: ${msg}`);
    } finally {
      setCodingSubmitting(false);
    }
  };

  const handleSaveInterviewSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewCard || !interviewDateTime) return;
    setInterviewSubmitting(true);
    try {
      const parsedDate = new Date(interviewDateTime);
      const isoDate = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
      const isAiMode = selectedInterviewType === "ai_interview";
      const targetStatus = isAiMode ? "interview" : "zoom_interview";

      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: interviewCard.id,
          scheduledAt: isoDate,
          durationMinutes: Number(interviewDuration),
          interviewerName: interviewerName || undefined,
          interviewerEmail: interviewerEmail || undefined,
          meetingLink: isAiMode ? undefined : (meetingLink || undefined),
          notes: interviewNotes || undefined,
          interviewType: selectedInterviewType,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatErrorMessage(resData, "Failed to schedule interview"));
      }

      // Sync application status to targetStatus ('interview' for AI Video Interview, 'zoom_interview' for Google Meet)
      await fetch(`/api/applications/${interviewCard.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      }).catch(() => {});

      // Optimistic state update & refresh
      setCards((prev) =>
        prev.map((c) =>
          c.id === interviewCard.id
            ? { ...c, status: targetStatus, interview_scheduled_at: isoDate }
            : c
        )
      );

      const scheduledCandidateName = interviewCard.candidate_name;

      setInterviewModalOpen(false);
      setInterviewCard(null);
      setInterviewDateTime("");
      setInterviewerName("");
      setInterviewerEmail("");
      setMeetingLink("");
      setInterviewNotes("");

      await fetchPipelineData();

      if (isAiMode) {
        alert(`✅ AI Video Interview Round Successfully Scheduled!\n\nCandidate: ${scheduledCandidateName}\nDate & Time: ${new Date(isoDate).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}\n\n🤖 AI Interview Lobby is now enabled on the candidate's portal!`);
      } else {
        const finalMeetLink = resData.data?.meeting_link || meetingLink;
        alert(`✅ Recruiter Google Meet Interview Successfully Scheduled!\n\nCandidate: ${scheduledCandidateName}\nGoogle Meet Link: ${finalMeetLink}\nDate & Time: ${new Date(isoDate).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}`);
      }
      logger.info(`[PipelinePage] Interview (${selectedInterviewType}) scheduled for application: ${interviewCard.id}`);
    } catch (err: unknown) {
      logger.error("Failed to save interview schedule", err);
      const msg = err instanceof Error ? err.message : formatErrorMessage(err, "Failed to schedule interview");
      alert(`Scheduling Error: ${msg}`);
    } finally {
      setInterviewSubmitting(false);
    }
  };

  const handleClearAll = () => {
    setSearch("");
    setSelectedJobId("");
    setTag("");
  };

  // Metrics Counters
  const metrics = React.useMemo(() => {
    const total = cards.length;
    const screening = cards.filter((c) => c.status === "screening").length;
    const interview = cards.filter((c) => c.status === "interview").length;
    const offer = cards.filter((c) => c.status === "offered").length;
    const rejected = cards.filter((c) => c.status === "rejected").length;

    return { total, screening, interview, offer, rejected };
  }, [cards]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto sh-animate-in">
      {/* Header */}
      <div className="flex justify-between items-center text-left border-b border-[#E8E8ED] pb-6">
        <div>
          <span className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider block">
            Hiring Board
          </span>
          <h1 className="text-[28px] font-bold text-[#1D1D1F] tracking-tight mt-1">
            Application Pipeline
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-1 font-medium">
            Drag and drop applicants between screening stages to audit active job pipelines.
          </p>
        </div>
      </div>

      {/* Prominent Job Selector Dropdown Card */}
      <div className="p-5 bg-white border border-[#D2D2D7] rounded-2xl shadow-sm text-left space-y-2">
        <label className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider block">
          Select Active Job Posting to View Pipeline
        </label>
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="w-full sm:max-w-md rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-2.5 text-[14px] font-semibold text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors shadow-sm cursor-pointer"
        >
          <option value="">-- Choose a Job Posting --</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      {!selectedJobId ? (
        <div className="py-24 text-center max-w-lg mx-auto space-y-4.5 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
            <Briefcase className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-zinc-900">Select Job Posting</h3>
            <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
              Please choose an active job posting from the dropdown above to view the applicant progression pipelines, scorecards, and run ATS screening processes.
            </p>
          </div>
        </div>
      ) : (
        <>

      {/* Metrics Counters */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonMetric key={i} />
          ))}
        </div>
      ) : (
        <MetricsBar {...metrics} />
      )}

      {/* Filters Toolbar */}
      <div className="pt-2">
        <PipelineFilters
          searchValue={search}
          jobValue={selectedJobId}
          tagValue={tag}
          onSearchChange={setSearch}
          onJobChange={setSelectedJobId}
          onTagChange={setTag}
          jobs={jobs}
          onClearFilters={handleClearAll}
        />
      </div>



      {/* Kanban Board Container */}
      {(() => {
        const isTechJob = !activeJobDetails ||
          activeJobDetails.title?.toLowerCase().includes("engineer") ||
          activeJobDetails.title?.toLowerCase().includes("developer") ||
          activeJobDetails.title?.toLowerCase().includes("tech") ||
          activeJobDetails.title?.toLowerCase().includes("full stack") ||
          activeJobDetails.title?.toLowerCase().includes("software");

        const activeColumns = isTechJob ? techColumns : nonTechColumns;

        return loading ? (
          <div className="flex gap-4 overflow-x-auto pb-6 pt-2 select-none no-scrollbar snap-x snap-mandatory">
            {activeColumns.slice(0, 4).map((col) => (
              <div key={col.key} className="w-72 shrink-0 flex flex-col bg-[#F5F5F7] rounded-[16px] border border-[#D2D2D7] p-4 min-h-[500px]">
                <div className="flex justify-between items-center mb-4 border-b border-[#E8E8ED] pb-2">
                  <span className="h-3 w-16 bg-[#AEAEB2]/30 rounded-md sh-skeleton" />
                  <span className="h-4 w-6 bg-[#AEAEB2]/30 rounded-full sh-skeleton" />
                </div>
                <div className="space-y-3">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6 pt-2 select-none no-scrollbar snap-x snap-mandatory">
            {activeColumns.map((col) => {
              let colCards = cards.filter((c) => {
                if (c.status === "rejected" || c.status === "withdrawn") {
                  const rejStage = c.rejection_stage || "screening";
                  return getCanonicalStageKey(rejStage) === col.key;
                }
                if (col.key === "interview") return ["interview", "ai_interview"].includes(c.status);
                if (col.key === "zoom_interview") return ["zoom_interview", "recruiter_review", "interview_scheduled", "final_interview"].includes(c.status);
                if (col.key === "offer_sent") return ["offer_sent", "offer_accepted", "joined", "offered"].includes(c.status);
                return c.status === col.key;
              });
            // Sort each column by its stage-specific score (highest first)
            if (col.key === "screening") {
              colCards = [...colCards].sort((a, b) => (b.screening_score || b.score || 0) - (a.screening_score || a.score || 0));
            } else if (col.key === "mcq") {
              colCards = [...colCards].sort((a, b) => (b.mcq_score || 0) - (a.mcq_score || 0));
            } else if (col.key === "coding") {
              colCards = [...colCards].sort((a, b) => (b.coding_score || 0) - (a.coding_score || 0));
            } else if (col.key === "interview") {
              colCards = [...colCards].sort((a, b) => (b.interview_avg_score || 0) - (a.interview_avg_score || 0));
            }

            return (
              <div
                key={col.key}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.key)}
                className="w-72 shrink-0 flex flex-col bg-[#F5F5F7] rounded-[16px] border border-[#D2D2D7] p-4 min-h-[500px] snap-center hover:border-[#AEAEB2] transition-colors"
              >
                {/* Column Title */}
                <div className="flex justify-between items-center mb-4 border-b border-[#E8E8ED] pb-2">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider truncate max-w-[130px]" title={col.name}>
                      {col.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (colCards.length > 0) {
                          handleAdvanceAll(col.key);
                        }
                      }}
                      disabled={colCards.length === 0}
                      className={`p-1 rounded transition-all flex items-center justify-center shrink-0 border border-transparent shadow-sm ${
                        colCards.length > 0
                          ? "bg-white text-[#0071E3] hover:text-[#0051A3] hover:border-[#D2D2D7] cursor-pointer bg-white/40"
                          : "bg-zinc-150/40 text-zinc-350 cursor-not-allowed border-none"
                      }`}
                      title={
                        colCards.length > 0
                          ? `Advance all ${colCards.length} candidates in ${col.name} to the next stage`
                          : "No candidates to advance"
                      }
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-white border border-[#D2D2D7] px-2 py-0.5 text-[11px] font-bold text-[#1D1D1F] tabular-nums">
                    {colCards.length}
                  </span>
                </div>

                {/* Profile Screening controls (ATS screening & Move Top N) */}
                {col.key === "screening" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        ATS Screening
                      </span>
                    </div>

                    {!selectedJobId ? (
                      <p className="text-[9px] text-[#AEAEB2] italic font-semibold">
                        Select a job to start screening candidates
                      </p>
                    ) : screeningLoading ? (
                      <div className="flex items-center gap-1.5 justify-center py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0071E3]" />
                        <span className="text-[10px] text-zinc-500 font-bold animate-pulse">Running ATS...</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <button
                          onClick={handleStartATSScreening}
                          className="w-full bg-[#0071E3] hover:bg-[#0051A3] text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        >
                          Start ATS Screening
                        </button>

                        {colCards.length > 0 && (
                          <div className="pt-2 border-t border-zinc-100 space-y-2">
                            <div className="flex items-center justify-between text-[9px] font-bold text-zinc-500">
                              <span>Objective Top N Advancement:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={topNLimit}
                                onChange={(e) => setTopNLimit(Number(e.target.value))}
                                className="h-7 text-[10px] font-bold rounded-lg border border-[#D2D2D7] bg-white px-2 py-0.5 outline-none select-none text-zinc-800"
                              >
                                {[1, 3, 5, 10, 20, 50].map((num) => (
                                  <option key={num} value={num}>
                                    Top {num}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAdvanceTopN("screening", topNLimit)}
                                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold h-7 rounded-lg transition-colors cursor-pointer"
                              >
                                Advance Top {Math.min(topNLimit, colCards.length)}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ Test scheduling controls */}
                {col.key === "mcq" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        EXAM SCHEDULER
                      </span>
                    </div>

                    {activeJobDetails?.mcq_scheduled_start_at ? (
                      <div className="space-y-2.5">
                        <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 text-left">
                          <p className="text-[10px] font-bold text-[#0071E3] uppercase tracking-wider">Scheduled Exam Time</p>
                          <p className="text-[11px] font-bold text-zinc-900 mt-0.5 font-sans">
                            {new Date(activeJobDetails.mcq_scheduled_start_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setMcqScheduleTime(
                              activeJobDetails.mcq_scheduled_start_at
                                ? new Date(new Date(activeJobDetails.mcq_scheduled_start_at).getTime() - new Date().getTimezoneOffset() * 60000)
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                            );
                            setMcqModalOpen(true);
                          }}
                          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                        >
                          Reschedule Exam
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[9px] text-[#6E6E73] font-semibold leading-relaxed">
                          No MCQ exam schedule has been configured yet for this job.
                        </p>
                        <button
                          onClick={() => {
                            setMcqScheduleTime("");
                            setMcqModalOpen(true);
                          }}
                          className="w-full bg-[#0071E3] hover:bg-[#0051A3] text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                        >
                          Schedule MCQ Exam
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Coding Round scheduling controls */}
                {col.key === "coding" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        CODING SCHEDULER
                      </span>
                    </div>

                    {activeJobDetails?.coding_scheduled_start_at ? (
                      <div className="space-y-2.5">
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2 text-left">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Scheduled Coding Exam</p>
                          <p className="text-[11px] font-bold text-zinc-900 mt-0.5 font-sans">
                            {new Date(activeJobDetails.coding_scheduled_start_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setCodingScheduleTime(
                              activeJobDetails.coding_scheduled_start_at
                                ? new Date(new Date(activeJobDetails.coding_scheduled_start_at).getTime() - new Date().getTimezoneOffset() * 60000)
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                            );
                            setCodingModalOpen(true);
                          }}
                          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                        >
                          Reschedule Coding Round
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[9px] text-[#6E6E73] font-semibold leading-relaxed">
                          No coding interview schedule configured yet for this job.
                        </p>
                        <button
                          onClick={() => {
                            setCodingScheduleTime("");
                            setCodingModalOpen(true);
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                        >
                          Schedule Coding Round
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interview scheduling panel */}
                {col.key === "interview" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Interview Scheduler</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 font-medium leading-relaxed">
                      Click any candidate card, then schedule their interview round with date, time, and meeting link.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-violet-50 border border-violet-100 p-2 text-center">
                        <p className="text-lg font-extrabold text-violet-700 tabular-nums">{cards.filter(c => c.status === "interview" && c.interview_scheduled_at).length}</p>
                        <p className="text-[9px] text-violet-500 font-bold uppercase tracking-wide">Scheduled</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-center">
                        <p className="text-lg font-extrabold text-amber-700 tabular-nums">{cards.filter(c => c.status === "interview" && !c.interview_scheduled_at).length}</p>
                        <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wide">Pending</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const firstUnscheduled = cards.find(c => c.status === "interview" && !c.interview_scheduled_at);
                        const targetCard = firstUnscheduled || cards.find(c => c.status === "interview") || cards[0];
                        if (targetCard) {
                          setInterviewCard(targetCard);
                          setInterviewDateTime(targetCard.interview_scheduled_at ? new Date(new Date(targetCard.interview_scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : getDefaultDatetimeLocal());
                          setInterviewModalOpen(true);
                        }
                      }}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold h-7 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                    >
                      <UserCheck className="h-3 w-3" /> Schedule Next Interview
                    </button>
                  </div>
                )}

                {/* Recruiter Google Meet control panel */}
                {col.key === "zoom_interview" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Recruiter Meet Room</span>
                      </div>
                      <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 tabular-nums">
                        {colCards.length} Active
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-500 font-medium leading-relaxed">
                      Conclude live interview, mark panel completed, and advance candidates to Offer Stage.
                    </p>
                    {colCards.length > 0 && (
                      <button
                        onClick={() => {
                          const targetCard = colCards[0];
                          if (targetCard) openOfferModalFor(targetCard);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> End Meeting & Complete Round
                      </button>
                    )}
                  </div>
                )}

                {/* Column Cards Stack */}
<div className="flex-grow space-y-3.5 overflow-y-auto max-h-[600px] pr-1 no-scrollbar">
  {colCards.map((card) => {
    const colIdx = activeColumns.findIndex((c) => c.key === col.key);
    const nextCol = colIdx >= 0 && colIdx < activeColumns.length - 1 ? activeColumns[colIdx + 1] : null;

    return (
      <ApplicationCard
        key={card.id}
        card={card}
        onClick={(c) => {
          if (col.key === "interview") {
            setInterviewCard(c);
            setInterviewDateTime(c.interview_scheduled_at ? new Date(new Date(c.interview_scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : getDefaultDatetimeLocal());
            setInterviewModalOpen(true);
          } else {
            setActiveCard(c);
          }
        }}
        onAdvance={handleAdvanceSingleCandidate}
        onReject={col.key === "offer_sent" ? undefined : (c) => handleRejectCandidate(c, col.key)}
        onReinstate={(c) => handleReinstateCandidate(c, col.key)}
        nextStageName={nextCol?.name}
      />
    );
  })}

  {colCards.length === 0 && (
    <div className="h-24 border border-dashed border-[#D2D2D7] bg-white/50 rounded-[16px] flex items-center justify-center text-[11px] text-[#AEAEB2] italic">
      Drag cards here
    </div>
  )}
</div>
</div>
);
})}
</div>
);
})()}
</>
)}

{/* Side Slide-out Details Drawer */}
<CandidateDrawer
card={activeCard}
onClose={() => setActiveCard(null)}
onScheduleInterview={(c) => {
  setInterviewCard(c);
  setInterviewDateTime(c.interview_scheduled_at ? new Date(new Date(c.interview_scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : getDefaultDatetimeLocal());
  setInterviewModalOpen(true);
}}
/>

{/* MCQ Scheduling Modal */}
{mcqModalOpen && (
<div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
  <form
    onSubmit={handleSaveMCQSchedule}
    className="w-full max-w-md bg-white border border-[#D2D2D7] rounded-[20px] shadow-2xl p-6 space-y-4 text-left scale-in-center"
  >
    <div>
      <h3 className="text-base font-bold text-zinc-900">Schedule MCQ Screening Exam</h3>
      <p className="text-[11px] text-[#6E6E73] mt-1 font-medium leading-relaxed">
        Set the exam start time and attach your PDF question template for candidates in the MCQ round.
      </p>
    </div>

    <div className="space-y-4 pt-1">
      <PdfUploader
        label="Upload MCQ Question Template PDF"
        description="Upload MCQ question template (.pdf file)"
        file={mcqPdfFile}
        onFileChange={setMcqPdfFile}
      />

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
          Select Exam Start Date & Time *
        </label>
        <input
          type="datetime-local"
          value={mcqScheduleTime}
          onChange={(e) => setMcqScheduleTime(e.target.value)}
          required
          className="w-full rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2.5 text-[13px] text-zinc-800 font-bold focus:border-[#0071E3] focus:outline-none transition-colors"
        />
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
      <button
        type="button"
        onClick={() => {
          setMcqModalOpen(false);
          setMcqPdfFile(null);
        }}
        className="px-4 py-2 text-[12px] font-bold text-zinc-650 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={mcqSubmitting || !mcqScheduleTime}
        className="bg-[#0071E3] hover:bg-[#0051A3] text-white text-[12px] font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mcqSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scheduling...
          </>
        ) : (
          "Confirm & Schedule Round"
        )}
      </button>
    </div>
  </form>
</div>
)}

{/* Coding Scheduling Modal */}
{codingModalOpen && (
<div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
  <form
    onSubmit={handleSaveCodingSchedule}
    className="w-full max-w-md bg-white border border-[#D2D2D7] rounded-[20px] shadow-2xl p-6 space-y-4 text-left scale-in-center"
  >
    <div>
      <h3 className="text-base font-bold text-zinc-900">Schedule Coding Interview Round</h3>
      <p className="text-[11px] text-[#6E6E73] mt-1 font-medium leading-relaxed">
        Set the coding interview round start time and attach your problem statement PDF template.
      </p>
    </div>

    <div className="space-y-4 pt-1">
      <PdfUploader
        label="Upload Coding Problem Template PDF"
        description="Upload custom problem statements & test specs (.pdf file)"
        file={codingPdfFile}
        onFileChange={setCodingPdfFile}
      />

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
          Select Coding Exam Start Date & Time *
        </label>
        <input
          type="datetime-local"
          value={codingScheduleTime}
          onChange={(e) => setCodingScheduleTime(e.target.value)}
          required
          className="w-full rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2.5 text-[13px] text-zinc-800 font-bold focus:border-emerald-600 focus:outline-none transition-colors"
        />
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
      <button
        type="button"
        onClick={() => {
          setCodingModalOpen(false);
          setCodingPdfFile(null);
        }}
        className="px-4 py-2 text-[12px] font-bold text-zinc-650 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={codingSubmitting || !codingScheduleTime}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {codingSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scheduling...
          </>
        ) : (
          "Confirm & Schedule Coding Round"
        )}
      </button>
    </div>
  </form>
</div>
)}

{/* Interview Scheduling Modal */}
{interviewModalOpen && (
<div className="fixed inset-0 bg-[#1D1D1F]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
  <form
    onSubmit={handleSaveInterviewSchedule}
    className="w-full max-w-lg bg-white border border-[#D2D2D7] rounded-[20px] shadow-2xl p-6 space-y-5 text-left"
  >
    {/* Header */}
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <Video className="h-4 w-4 text-violet-600" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">Schedule Interview</h3>
        </div>
        {interviewCard && (
          <p className="text-[11px] text-zinc-500 font-medium">
            Candidate: <span className="font-bold text-zinc-800">{interviewCard.candidate_name}</span> — {interviewCard.job_title}
          </p>
        )}
      </div>
      <button type="button" onClick={() => { setInterviewModalOpen(false); setInterviewCard(null); setInterviewPdfFile(null); }}
        className="text-zinc-400 hover:text-zinc-700 h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors">
        ✕
      </button>
    </div>

    <div className="grid grid-cols-2 gap-3.5">
      {/* 1. Round Type Selector Card */}
      <div className="col-span-2 space-y-1.5 text-left">
        <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
          Select Evaluation Round Type *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setSelectedInterviewType("ai_interview")}
            className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              selectedInterviewType === "ai_interview"
                ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600" /> AI Video Interview Round
              </span>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase">AI Lobby</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-1.5 leading-tight font-medium">
              Candidate conducts AI video interview in browser lobby. Rated by Gemini AI with automated scorecard.
            </p>
          </div>

          <div
            onClick={() => setSelectedInterviewType("zoom_interview")}
            className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              selectedInterviewType === "zoom_interview"
                ? "border-violet-600 bg-violet-50/80 ring-2 ring-violet-500/20"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-950 flex items-center gap-1.5">
                <Video className="h-4 w-4 text-violet-600" /> Recruiter Live Call
              </span>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-600 text-white uppercase">Google Meet</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-1.5 leading-tight font-medium">
              Live video call with human recruiter. Sends Google Meet link for final round evaluation.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Conditional Details based on Type */}
      {selectedInterviewType === "ai_interview" ? (
        <div className="col-span-2 p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-center gap-3 text-left">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-blue-950">AI Video Lobby Option Enabled</h4>
            <p className="text-[11px] text-blue-900 font-medium leading-relaxed mt-0.5">
              Candidate will be able to enter the <strong>AI Video Interview Room</strong> directly from their applicant portal at the scheduled time. No Google Meet link required!
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Google Meet Link Generator Card */}
          <div className="col-span-2 p-3.5 bg-violet-50/60 border border-violet-200/60 rounded-2xl space-y-2 text-left shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-violet-600" /> Google Meet Video Room Link *
              </label>
              <button
                type="button"
                onClick={() => {
                  const code = `smh-${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}`;
                  setMeetingLink(`https://meet.google.com/${code}`);
                }}
                className="text-[10px] font-bold text-violet-700 hover:text-violet-900 bg-white border border-violet-200 px-2.5 py-1 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
              >
                ⚡ Auto-Generate Link
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="url"
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/smh-xxx-xxxx"
                required={selectedInterviewType === "zoom_interview"}
                className="flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[12px] font-bold text-zinc-900 focus:border-violet-600 focus:outline-none shadow-2xs"
              />
              {meetingLink && (
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold shrink-0 transition-colors shadow-2xs flex items-center gap-1"
                >
                  Test Link 🔗
                </a>
              )}
            </div>
          </div>

          {/* Interviewer Name & Email */}
          <div className="col-span-1 space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Interviewer Name</label>
            <input
              type="text"
              value={interviewerName}
              onChange={e => setInterviewerName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] font-bold text-zinc-800 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="col-span-1 space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Interviewer Email</label>
            <input
              type="email"
              value={interviewerEmail}
              onChange={e => setInterviewerEmail(e.target.value)}
              placeholder="interviewer@company.com"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] font-bold text-zinc-800 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </>
      )}

      <div className="col-span-2">
        <PdfUploader
          label="Upload Interview Evaluation Rubric / Questions PDF (Optional)"
          description="Upload custom interview questions or rubric (.pdf file)"
          file={interviewPdfFile}
          onFileChange={setInterviewPdfFile}
        />
      </div>

      {/* Date & Time */}
      <div className="col-span-1 space-y-1">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Interview Date & Time *
        </label>
        <input
          type="datetime-local"
          value={interviewDateTime}
          onChange={e => setInterviewDateTime(e.target.value)}
          required
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-[12px] font-bold text-zinc-800 focus:border-violet-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Duration */}
      <div className="col-span-1 space-y-1">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
          <Clock className="h-3 w-3" /> Duration
        </label>
        <select
          value={interviewDuration}
          onChange={e => setInterviewDuration(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-[12px] font-bold text-zinc-800 focus:border-violet-500 focus:outline-none"
        >
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
          <option value="90">90 minutes</option>
          <option value="120">2 hours</option>
        </select>
      </div>

      {/* Notes */}
      <div className="col-span-2 space-y-1">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Focus Topics / Notes (Optional)</label>
        <textarea
          value={interviewNotes}
          onChange={e => setInterviewNotes(e.target.value)}
          placeholder="Topics to cover, specific technical areas to probe..."
          rows={2}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-[12px] text-zinc-800 focus:border-violet-500 focus:outline-none resize-none placeholder:text-zinc-300"
        />
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100">
      <button type="button" onClick={() => { setInterviewModalOpen(false); setInterviewCard(null); setInterviewPdfFile(null); }}
        className="px-4 py-2 text-[12px] font-bold text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer">
        Cancel
      </button>
      <button type="submit" disabled={interviewSubmitting || !interviewDateTime}
        className="bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold px-5 py-2 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
        {interviewSubmitting ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scheduling...</>
        ) : (
          <><Video className="h-3.5 w-3.5" /> Confirm Interview</>
        )}
      </button>
    </div>
  </form>
</div>
)}

{/* Offer Letter Generator & PDF Preview Modal */}
{offerModalCard && (
<div className="fixed inset-0 bg-[#1D1D1F]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
  <div className="w-full max-w-4xl bg-white border border-[#D2D2D7] rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left">
    {/* Header */}
    <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold">Generate Official Offer Letter PDF</h3>
          <p className="text-[11px] text-emerald-100 font-medium">
            Candidate: <span className="font-bold underline">{offerModalCard.candidate_name}</span> ({offerModalCard.candidate_email})
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOfferModalCard(null)}
        className="text-white/80 hover:text-white h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-base transition-colors"
      >
        ✕
      </button>
    </div>

    {/* Body Split Grid */}
    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 overflow-hidden">
      {/* Left Form Controls (2 cols) */}
      <div className="md:col-span-2 p-5 border-r border-zinc-200 bg-zinc-50/50 space-y-3.5 overflow-y-auto">
        <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Offer Details</h4>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Hiring Organization / Company Name *</label>
          <input
            type="text"
            value={offerCompanyName}
            onChange={(e) => setOfferCompanyName(e.target.value)}
            placeholder="e.g. Acme Technologies Inc."
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Company Division / Dept</label>
          <input
            type="text"
            value={offerCompanyDivision}
            onChange={(e) => setOfferCompanyDivision(e.target.value)}
            placeholder="e.g. Corporate HR & Talent Acquisition Division"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Candidate Name</label>
          <input
            type="text"
            readOnly
            value={offerModalCard.candidate_name}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Job Title / Role</label>
          <input
            type="text"
            readOnly
            value={offerModalCard.job_title}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Annual Salary / Compensation *</label>
          <input
            type="text"
            value={offerSalary}
            onChange={(e) => setOfferSalary(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Proposed Start / Joining Date *</label>
          <input
            type="date"
            value={offerJoiningDate}
            onChange={(e) => setOfferJoiningDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Work Location / Model</label>
          <input
            type="text"
            value={offerLocation}
            onChange={(e) => setOfferLocation(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Right Offer Letter PDF Document Preview (3 cols) */}
      <div className="md:col-span-3 p-6 bg-zinc-200/80 overflow-y-auto flex flex-col items-center">
        <div className="w-full max-w-lg bg-white text-zinc-900 rounded-2xl shadow-2xl p-8 space-y-5 text-left border border-zinc-300 font-sans leading-relaxed text-xs">
          {/* Document Header */}
          <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-end">
            <div>
              <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">Official Appointment Document</span>
              <h2 className="text-base font-black text-zinc-900 tracking-tight mt-0.5 uppercase">{offerCompanyName || "HIRING COMPANY"}</h2>
              <p className="text-[10px] text-zinc-500 font-medium">{offerCompanyDivision || "Corporate HR Division"}</p>
            </div>
            <div className="text-right text-[9px] font-mono text-zinc-500 font-bold">
              <div>REF: OFFER-2026-{offerModalCard.id.slice(0, 6)}</div>
              <div>DATE: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</div>
            </div>
          </div>

          {/* Letter Recipient */}
          <div className="space-y-0.5">
            <p className="font-bold text-zinc-900">To:</p>
            <p className="font-extrabold text-sm text-zinc-900">{offerModalCard.candidate_name}</p>
            <p className="text-zinc-600 text-[11px]">{offerModalCard.candidate_email}</p>
          </div>

          {/* Subject */}
          <div className="font-bold text-zinc-900 border-l-4 border-emerald-600 pl-3 py-1 bg-emerald-50 text-[11px]">
            SUBJECT: Employment Offer for Position of {offerModalCard.job_title}
          </div>

          {/* Body Text */}
          <div className="space-y-3 text-zinc-700 text-[11px] leading-normal">
            <p>Dear <span className="font-bold text-zinc-900">{offerModalCard.candidate_name}</span>,</p>
            <p>
              We are pleased to extend this formal offer of employment to join <span className="font-bold text-zinc-900">{offerCompanyName || "our organization"}</span> as a <span className="font-bold text-zinc-900">{offerModalCard.job_title}</span>. We were thoroughly impressed by your background, technical scorecards, and performance throughout our evaluation pipeline conducted via the <span className="font-semibold text-zinc-900">SmartHire AI Hiring Platform</span>.
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1.5 font-mono text-[10px] text-zinc-900">
              <div className="flex justify-between"><span>Annual Compensation:</span><span className="font-bold text-emerald-700">{offerSalary}</span></div>
              <div className="flex justify-between"><span>Joining Date:</span><span className="font-bold">{offerJoiningDate}</span></div>
              <div className="flex justify-between"><span>Work Location:</span><span className="font-bold">{offerLocation}</span></div>
            </div>
            <p>
              This offer is subject to standard employment verification and compliance. Please review this letter and confirm your acceptance.
            </p>
          </div>

          {/* Signatures */}
          <div className="pt-5 border-t border-zinc-200 grid grid-cols-2 gap-6 text-[10px]">
            <div>
              <p className="font-bold text-zinc-900">For {offerCompanyName || "Hiring Company"}</p>
              <div className="h-10 my-1 font-serif italic text-emerald-800 text-sm flex items-end">Authorized HR Executive</div>
              <p className="text-zinc-500 font-semibold border-t border-zinc-300 pt-1">Hiring Manager Signature</p>
            </div>
            <div>
              <p className="font-bold text-zinc-900">Candidate Acceptance</p>
              <div className="h-10 my-1 font-serif italic text-zinc-400 text-xs flex items-end">Pending Acceptance Signature</div>
              <p className="text-zinc-500 font-semibold border-t border-zinc-300 pt-1">{offerModalCard.candidate_name}</p>
            </div>
          </div>

          {/* Platform Attribution Badge */}
          <div className="pt-3 border-t border-dashed border-zinc-200 text-center text-[9px] text-zinc-400 font-medium flex items-center justify-center gap-1">
            <span>Evaluated & Dispatched via SmartHire AI Hiring Platform</span>
          </div>
        </div>
      </div>
    </div>

    {/* Footer Actions */}
    <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center shrink-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        🖨️ Print / Download PDF
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOfferModalCard(null)}
          className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={offerSending}
          onClick={async () => {
            setOfferSending(true);
            try {
              const customOfferPayload = {
                salary: offerSalary,
                joiningDate: offerJoiningDate,
                location: offerLocation,
                candidateName: offerModalCard.candidate_name,
                jobTitle: offerModalCard.job_title,
                sentAt: new Date().toISOString(),
              };

              localStorage.setItem(`smarthire_custom_offer_${offerModalCard.id}`, JSON.stringify(customOfferPayload));

              // Update database status to offer_sent
              await fetch(`/api/applications/${offerModalCard.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "offer_sent" }),
              });

              // Optimistically update card status in state
              setCards((prev) =>
                prev.map((c) => (c.id === offerModalCard.id ? { ...c, status: "offer_sent" } : c))
              );

              alert(`✅ Official Offer Letter customized & dispatched to ${offerModalCard.candidate_email}! Candidate can now view & accept it in their portal.`);
              setOfferModalCard(null);
            } catch (err) {
              logger.error("Failed to send customized offer letter", err);
              alert("Failed to send offer letter. Please try again.");
            } finally {
              setOfferSending(false);
            }
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          {offerSending ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
          ) : (
            <>✉️ Send Offer Letter PDF</>
          )}
        </button>
      </div>
    </div>
  </div>
</div>
)}
</div>
);
}
