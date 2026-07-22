"use client";

import * as React from "react";
import { ApplicationCard, CandidateDrawer, PipelineFilters, MetricsBar, CandidateAppCard } from "@/components/pipeline";
import { logger } from "@smarthire/logger";
import { SkeletonMetric, SkeletonCard } from "@/components/shared/Skeleton";
import { CheckCircle2, XCircle, Archive, ChevronRight, Loader2, Briefcase, Sparkles, Video, UserCheck, Calendar, Clock, Link as LinkIcon } from "lucide-react";
import { Button } from "@smarthire/ui";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

const columns = [
  { key: "applied", name: "Applied" },
  { key: "screening", name: "Profile Screening" },
  { key: "mcq", name: "MCQ Test" },
  { key: "coding", name: "Coding Round" },
  { key: "interview", name: "Interview" },
];

export default function PipelinePage() {
  const [cards, setCards] = React.useState<CandidateAppCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedJobId, setSelectedJobId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [jobs, setJobs] = React.useState<{ id: string; title: string }[]>([]);

  // Drawer detail state
  const [activeCard, setActiveCard] = React.useState<CandidateAppCard | null>(null);
  const [activeBinKey, setActiveBinKey] = React.useState<string | null>(null);
  const [screeningLoading, setScreeningLoading] = React.useState(false);
  const [topNLimit, setTopNLimit] = React.useState(30);

  // MCQ & Coding scheduling state
  const [activeJobDetails, setActiveJobDetails] = React.useState<{
    id: string;
    title: string;
    mcq_assessment_id: string | null;
    mcq_scheduled_start_at: string | null;
    coding_assessment_id?: string | null;
    coding_scheduled_start_at?: string | null;
  } | null>(null);
  const [assessmentTemplates, setAssessmentTemplates] = React.useState<{ id: string; title: string }[]>([]);
  const [mcqModalOpen, setMcqModalOpen] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [mcqScheduleTime, setMcqScheduleTime] = React.useState("");
  const [mcqSubmitting, setMcqSubmitting] = React.useState(false);

  // Coding scheduling state
  const [codingModalOpen, setCodingModalOpen] = React.useState(false);
  const [selectedCodingTemplateId, setSelectedCodingTemplateId] = React.useState("");
  const [codingScheduleTime, setCodingScheduleTime] = React.useState("");
  const [codingSubmitting, setCodingSubmitting] = React.useState(false);

  // Interview scheduling state
  const [interviewModalOpen, setInterviewModalOpen] = React.useState(false);
  const [interviewCard, setInterviewCard] = React.useState<CandidateAppCard | null>(null);
  const [interviewDateTime, setInterviewDateTime] = React.useState("");
  const [interviewDuration, setInterviewDuration] = React.useState("60");
  const [interviewerName, setInterviewerName] = React.useState("");
  const [interviewerEmail, setInterviewerEmail] = React.useState("");
  const [meetingLink, setMeetingLink] = React.useState("");
  const [interviewNotes, setInterviewNotes] = React.useState("");
  const [interviewSubmitting, setInterviewSubmitting] = React.useState(false);

  const getDefaultDatetimeLocal = React.useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    return new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const fetchPipelineData = React.useCallback(async () => {
    if (!selectedJobId) {
      setCards([]);
      setLoading(false);
      setActiveJobDetails(null);
      return;
    }
    setLoading(true);
    try {
      // Fetch active job details
      const { data: jobData } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, title, mcq_assessment_id, mcq_scheduled_start_at, coding_assessment_id, coding_scheduled_start_at")
        .eq("id", selectedJobId)
        .single();
      
      if (jobData) {
        setActiveJobDetails(jobData);
      }

      // Fetch assessment templates
      const { data: templates } = await supabase
        .schema("assessment")
        .from("assessments")
        .select("id, title");
      
      if (templates) {
        setAssessmentTemplates(templates);
      }

      // 1. Fetch all active applications from application schema
      const params = new URLSearchParams();
      params.append("jobId", selectedJobId);

      const appRes = await fetch(`/api/applications?${params.toString()}`);
      if (!appRes.ok) throw new Error("Failed to fetch applications");
      const { data: appsList } = await appRes.json();

      interface AppItem {
        id: string;
        candidate_id: string;
        job_id: string;
        status: string;
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

  // Load jobs list options & pipeline data
  React.useEffect(() => {
    const loadJobsList = async () => {
      try {
        const { data } = await supabase.schema("job").from("jobs").select("id, title").is("deleted_at", null);
        setJobs(data || []);
      } catch (err) {
        logger.error("Failed to fetch jobs options", err);
      }
    };
    loadJobsList();
  }, []);

  React.useEffect(() => {
    fetchPipelineData();
  }, [fetchPipelineData]);

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

      if (!res.ok) throw new Error("Status transition API rejected drop");
      logger.info(`[PipelinePage] Application ${appId} dragged to stage: ${targetStatus}`);

      // Auto-open interview scheduling modal if dropped in interview column
      if (targetStatus === "interview") {
        setInterviewCard(draggedCard);
        setInterviewDateTime(draggedCard.interview_scheduled_at ? new Date(new Date(draggedCard.interview_scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : getDefaultDatetimeLocal());
        setInterviewModalOpen(true);
      }
    } catch (err) {
      logger.error("Drag and drop transition failed, rolling back UI", err);
      // Rollback UI
      setCards(previousCards);
    }
  };

  const handleAdvanceAll = async (currentStatus: string) => {
    const statusSequence = ["applied", "screening", "mcq", "coding", "interview", "offered"];
    const currentIndex = statusSequence.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === statusSequence.length - 1) return;

    const nextStatus = statusSequence[currentIndex + 1];
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

  const handleMoveTopN = async (count: number) => {
    const screeningCards = cards
      .filter((c) => c.status === "screening")
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const targetCards = screeningCards.slice(0, count);
    if (targetCards.length === 0) return;

    const previousCards = [...cards];

    // Optimistically update the UI: move selected top N to 'mcq'
    setCards((prev) =>
      prev.map((c) =>
        targetCards.some((tc) => tc.id === c.id) ? { ...c, status: "mcq" } : c
      )
    );

    try {
      const updatePromises = targetCards.map((card) =>
        fetch(`/api/applications/${card.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "mcq" }),
        })
      );

      const results = await Promise.all(updatePromises);
      const failed = results.some((res) => !res.ok);
      if (failed) throw new Error();
      logger.info(`[PipelinePage] Batch moved top ${targetCards.length} candidates from screening to mcq`);
    } catch (err) {
      logger.error("Move top N transition failed, rolling back UI", err);
      setCards(previousCards);
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
          assessmentId: selectedTemplateId || undefined,
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
          assessmentId: selectedCodingTemplateId || undefined,
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

      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: interviewCard.id,
          scheduledAt: isoDate,
          durationMinutes: Number(interviewDuration),
          interviewerName: interviewerName || undefined,
          interviewerEmail: interviewerEmail || undefined,
          meetingLink: meetingLink || undefined,
          notes: interviewNotes || undefined,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || resData.message || "Failed to schedule interview");
      }

      // Sync application status to 'interview'
      await fetch(`/api/applications/${interviewCard.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "interview" }),
      }).catch(() => {});

      // Optimistic state update & refresh
      setCards((prev) =>
        prev.map((c) =>
          c.id === interviewCard.id
            ? { ...c, status: "interview", interview_scheduled_at: new Date(interviewDateTime).toISOString() }
            : c
        )
      );

      setInterviewModalOpen(false);
      const scheduledCandidateName = interviewCard.candidate_name;
      setInterviewCard(null);
      setInterviewDateTime("");
      setInterviewerName("");
      setInterviewerEmail("");
      setMeetingLink("");
      setInterviewNotes("");

      await fetchPipelineData();
      alert(`✅ Interview successfully scheduled for ${scheduledCandidateName}!`);
      logger.info(`[PipelinePage] Interview scheduled for application: ${interviewCard.id}`);
    } catch (err: unknown) {
      logger.error("Failed to save interview schedule", err);
      const msg = err instanceof Error ? err.message : String(err);
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

      {/* Top Bins Drop Zones */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4.5 pt-2">
          {[
            { key: "offered", name: "Offers", bg: "bg-emerald-50/20 hover:bg-emerald-50/45", border: "border-emerald-200 hover:border-emerald-400", text: "text-emerald-600", icon: CheckCircle2 },
            { key: "rejected", name: "Rejected", bg: "bg-red-50/20 hover:bg-red-50/45", border: "border-red-200 hover:border-red-400", text: "text-red-600", icon: XCircle },
            { key: "withdrawn", name: "Withdrawn", bg: "bg-zinc-50/30 hover:bg-zinc-50/70", border: "border-zinc-200 hover:border-zinc-400", text: "text-zinc-600", icon: Archive },
          ].map((bin) => {
            const binCards = cards.filter((c) => c.status === bin.key);
            const Icon = bin.icon;

            return (
              <div
                key={bin.key}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, bin.key)}
                onClick={() => setActiveBinKey(bin.key)}
                className={`flex items-center justify-between p-4 rounded-xl border border-dashed ${bin.border} ${bin.bg} transition-all duration-200 cursor-pointer group shadow-sm`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-white border border-zinc-200 shrink-0 shadow-sm">
                    <Icon className={`h-4.5 w-4.5 ${bin.text}`} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider">
                      {bin.name} Bin
                    </h4>
                    <p className="text-[9px] text-zinc-500 font-semibold group-hover:text-zinc-700 transition-colors">
                      Click to review / Drag here
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-white border px-2.5 py-0.5 text-xs font-bold text-zinc-900 shadow-sm tabular-nums">
                    {binCards.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bin Candidates List Modal */}
      {activeBinKey && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col text-left overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-150 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 capitalize">
                  {activeBinKey === "offered" ? "Offers" : activeBinKey} Bin Candidates
                </h3>
                <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
                  Review finalized applicants and reset them back to the active pipeline.
                </p>
              </div>
              <button
                onClick={() => setActiveBinKey(null)}
                className="text-zinc-400 hover:text-zinc-650 font-bold text-sm h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                âœ•
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-grow max-h-[50vh] no-scrollbar">
              {cards.filter((c) => c.status === activeBinKey).length === 0 ? (
                <div className="text-center py-10 text-zinc-500 italic text-xs border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                  No candidates currently in this stage bin.
                </div>
              ) : (
                cards
                  .filter((c) => c.status === activeBinKey)
                  .map((cand) => (
                    <div
                      key={cand.id}
                      className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/10 flex items-center justify-between gap-4 hover:border-zinc-300 transition-colors"
                    >
                      <div className="space-y-0.5 text-left">
                        <p className="font-bold text-sm text-zinc-900">{cand.candidate_name}</p>
                        <p className="text-[10px] text-zinc-500 font-medium">{cand.candidate_email}</p>
                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1.5">
                          Position: {cand.job_title}
                        </p>
                      </div>
                      <Button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const previousCards = [...cards];
                          // Optimistic update - move back to applied
                          setCards((prev) =>
                            prev.map((c) => (c.id === cand.id ? { ...c, status: "applied" } : c))
                          );
                          try {
                            const res = await fetch(`/api/applications/${cand.id}/status`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "applied" }),
                            });
                            if (!res.ok) throw new Error();
                            logger.info(`[PipelinePage] Application ${cand.id} reset to active applied column`);
                          } catch (err) {
                            logger.error("Reset status request failed, rolling back UI", err);
                            setCards(previousCards);
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold h-8 px-3 rounded-lg shadow-sm"
                      >
                        Reset to Applied
                      </Button>
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-150 bg-zinc-50/40 flex justify-end">
              <Button
                onClick={() => setActiveBinKey(null)}
                className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold px-4 h-9 rounded-lg"
              >
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board Container */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 select-none no-scrollbar snap-x snap-mandatory">
          {columns.slice(0, 4).map((col) => (
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
          {columns.map((col) => {
            let colCards = cards.filter((c) => c.status === col.key);
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
                              <span>Move Top Cohort:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={topNLimit}
                                onChange={(e) => setTopNLimit(Number(e.target.value))}
                                className="h-7 text-[10px] font-bold rounded-lg border border-[#D2D2D7] bg-white px-2 py-0.5 outline-none select-none text-zinc-800"
                              >
                                {[3, 5, 10, 30, 50].map((num) => (
                                  <option key={num} value={num}>
                                    Top {num}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleMoveTopN(topNLimit)}
                                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold h-7 rounded-lg transition-colors cursor-pointer"
                              >
                                Move Top {Math.min(topNLimit, colCards.length)}
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

                {/* Column Cards Stack */}
                <div className="flex-grow space-y-3.5 overflow-y-auto max-h-[600px] pr-1 no-scrollbar">
                  {colCards.map((card) => (
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
                    />
                  ))}

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
        )}
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
                Set the exam start time. When reached, candidates in the MCQ column will automatically be permitted to start the test.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-blue-50/30 to-purple-50/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                    <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
                    <span>AI MCQ Assessment Generator</span>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Auto-Tailored
                  </span>
                </div>
                <p className="text-[11px] text-zinc-650 font-medium leading-relaxed">
                  MCQ questions will be <strong>automatically generated</strong> based on the job description, required skills, and domain context.
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px] text-indigo-800 font-semibold">
                  <span>Custom Template (Optional):</span>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[11px] font-bold text-zinc-800 focus:outline-none"
                  >
                    <option value="">âœ¨ Auto AI Generated (Recommended)</option>
                    {assessmentTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Select Exam Start Date & Time
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
                onClick={() => setMcqModalOpen(false)}
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
                Set the coding interview round start time. Selected candidates will automatically receive notifications and will be allowed into the built-in IDE environment when live.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-blue-50/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
                    <span>AI Coding Assessment Generator</span>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Auto-Tailored
                  </span>
                </div>
                <p className="text-[11px] text-zinc-650 font-medium leading-relaxed">
                  Coding interview problems & test cases will be <strong>automatically generated</strong> based on the job description and required tech stack.
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                  <span>Custom Template (Optional):</span>
                  <select
                    value={selectedCodingTemplateId}
                    onChange={(e) => setSelectedCodingTemplateId(e.target.value)}
                    className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] font-bold text-zinc-800 focus:outline-none"
                  >
                    <option value="">âœ¨ Auto AI Generated (Recommended)</option>
                    {assessmentTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Select Coding Exam Start Date & Time
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
                onClick={() => setCodingModalOpen(false)}
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
              <button type="button" onClick={() => { setInterviewModalOpen(false); setInterviewCard(null); }}
                className="text-zinc-400 hover:text-zinc-700 h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Date & Time */}
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Interview Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={interviewDateTime}
                  onChange={e => setInterviewDateTime(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] font-bold text-zinc-800 focus:border-violet-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Duration */}
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Duration
                </label>
                <select
                  value={interviewDuration}
                  onChange={e => setInterviewDuration(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] font-bold text-zinc-800 focus:border-violet-500 focus:outline-none"
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
                  placeholder="Topics to cover, specific technical areas for AI to probe..."
                  rows={2}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[12px] text-zinc-800 focus:border-violet-500 focus:outline-none resize-none placeholder:text-zinc-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100">
              <button type="button" onClick={() => { setInterviewModalOpen(false); setInterviewCard(null); }}
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
    </div>
  );
}
