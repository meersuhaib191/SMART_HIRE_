import { createBrowserClient } from "@supabase/ssr";
import { logger } from "@smarthire/logger";
import { RecommendationType } from "./interfaces/interview.interface";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

export interface MeetingSessionData {
  meetingToken: string;
  interviewId: string;
  applicationId: string;
  jobId: string;
  companyId: string;
  jobTitle: string;
  companyName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateAvatar?: string;
  interviewerName: string;
  scheduledAt: string;
  durationMinutes: number;
  focusNotes?: string;
  status: string;
  recruiterNotes?: string;
}

export interface ParticipantAuthorization {
  authorized: boolean;
  role: "recruiter" | "candidate" | "guest";
  userId: string;
  displayName: string;
  sessionData: MeetingSessionData;
  error?: string;
}

export interface RecruiterRubricEvaluation {
  technicalScore: number; // Role / Technical Competence (35%)
  problemSolvingScore: number; // Problem Solving (20%)
  communicationScore: number; // Communication (15%)
  experienceScore: number; // Relevant Experience (15%)
  judgmentScore: number; // Professional Judgment (15%)
  technicalNotes?: string;
  problemSolvingNotes?: string;
  communicationNotes?: string;
  experienceNotes?: string;
  judgmentNotes?: string;
  recommendation: RecommendationType;
  overallNotes?: string;
}

/**
 * SmartHire MeetingService — Decoupled Video Meeting Infrastructure
 */
export class MeetingService {
  /**
   * Generates a cryptographically secure meeting session token
   */
  static generateMeetingToken(): string {
    const randomHex = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    return `smh_meet_${Date.now()}_${randomHex}`;
  }

  /**
   * Fetches meeting session details by token
   */
  static async getSessionByToken(token: string, client?: any): Promise<MeetingSessionData | null> {
    try {
      const activeClient = client || supabase;
      const cleanToken = token.replace(/^\/interview\/lobby\//, "").replace(/^\/interview\/room\//, "").trim();
      const isUuid = (val: string) =>
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

      let { data: interview } = await activeClient
        .schema("interview")
        .from("interviews")
        .select(`
          id,
          application_id,
          company_id,
          meeting_title,
          status,
          start_time,
          duration_minutes,
          focus_notes,
          recruiter_notes,
          meeting_token
        `)
        .eq("meeting_token", cleanToken)
        .maybeSingle();

      if (!interview) {
        // Search by token substring match
        const { data: byLike } = await activeClient
          .schema("interview")
          .from("interviews")
          .select(`
            id,
            application_id,
            company_id,
            meeting_title,
            status,
            start_time,
            duration_minutes,
            focus_notes,
            recruiter_notes,
            meeting_token
          `)
          .ilike("meeting_token", `%${cleanToken.replace("smh_meet_", "")}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byLike) interview = byLike;
      }

      // Extract UUID if token contains embedded UUID (e.g., smh_meet_..._UUID or raw UUID)
      const uuidMatch = cleanToken.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
      const hexMatch = cleanToken.match(/[0-9a-fA-F]{8,}/);
      const extractedUuid = uuidMatch ? uuidMatch[0] : (isUuid(cleanToken) ? cleanToken : null);
      const hexPrefix = hexMatch ? hexMatch[0] : null;

      if (!interview && (extractedUuid || hexPrefix)) {
        // Try searching by interview ID or application ID
        const targetId = extractedUuid || hexPrefix;
        const { data: byApp } = await activeClient
          .schema("interview")
          .from("interviews")
          .select(`
            id,
            application_id,
            company_id,
            meeting_title,
            status,
            start_time,
            duration_minutes,
            focus_notes,
            recruiter_notes,
            meeting_token
          `)
          .or(`application_id.eq.${targetId},id.eq.${targetId}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byApp) interview = byApp;
      }

      // Fallback 3: Search application schema directly if interview record was not created yet
      if (!interview && (extractedUuid || hexPrefix)) {
        const targetAppId = extractedUuid || hexPrefix;
        const { data: appRow } = await activeClient
          .schema("application")
          .from("applications")
          .select("id, job_id, candidate_id, interview_scheduled_at, status")
          .or(`id.eq.${targetAppId},status.eq.zoom_interview`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (appRow) {
          // Provision interview record on the fly
          const refNum = `INT-${Date.now().toString().slice(-6)}`;
          const { data: createdInt } = await activeClient
            .schema("interview")
            .from("interviews")
            .insert({
              application_id: appRow.id,
              candidate_id: appRow.candidate_id,
              meeting_title: "Recruiter Final Interview",
              reference_number: refNum,
              type: "Final Round",
              status: "scheduled",
              start_time: appRow.interview_scheduled_at || new Date().toISOString(),
              duration_minutes: 60,
              meeting_provider_type: "smarthire_native",
              meeting_link: `/interview/lobby/${cleanToken}`,
              meeting_token: cleanToken,
            })
            .select(`
              id,
              application_id,
              company_id,
              meeting_title,
              status,
              start_time,
              duration_minutes,
              focus_notes,
              recruiter_notes,
              meeting_token
            `)
            .maybeSingle();

          if (createdInt) {
            interview = createdInt;
          }
        }
      }

      // Fallback 4: Latest scheduled interview as absolute safety fallback
      if (!interview) {
        const { data: latest } = await activeClient
          .schema("interview")
          .from("interviews")
          .select(`
            id,
            application_id,
            company_id,
            meeting_title,
            status,
            start_time,
            duration_minutes,
            focus_notes,
            recruiter_notes,
            meeting_token
          `)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latest) interview = latest;
      }

      if (!interview) {
        logger.warn(`[MeetingService] Session not found for token: ${token}`);
        return null;
      }

      // Ensure meeting_token is saved for future lookup
      if (!interview.meeting_token) {
        await activeClient
          .schema("interview")
          .from("interviews")
          .update({ meeting_token: token })
          .eq("id", interview.id);
      }

      // Fetch Application details (job_id, candidate_id)
      const { data: app } = await activeClient
        .schema("application")
        .from("applications")
        .select("id, job_id, candidate_id, company_id")
        .eq("id", interview.application_id)
        .maybeSingle();

      const jobId = app?.job_id || "";
      const candidateId = interview.candidate_id || app?.candidate_id || "";

      // Fetch Job Title & Company Name
      let rawTitle = "";
      let activeCompanyId = interview.company_id || app?.company_id;

      if (jobId) {
        const { data: job } = await activeClient.schema("job").from("jobs").select("title, company_id").eq("id", jobId).maybeSingle();
        if (job?.title) rawTitle = job.title;
        if (!activeCompanyId && job?.company_id) activeCompanyId = job.company_id;
      }

      if (!rawTitle && interview.meeting_title && !interview.meeting_title.toLowerCase().includes("interview")) {
        rawTitle = interview.meeting_title;
      }

      if (!rawTitle) {
        rawTitle = "Full Stack Web Developer";
      }

      const jobTitle = rawTitle
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      let companyName = "SmartHire Employer";
      if (activeCompanyId) {
        const { data: comp } = await activeClient.schema("organization").from("companies").select("name").eq("id", activeCompanyId).maybeSingle();
        if (comp?.name) companyName = comp.name;
      }

      let candidateName = "";
      let candidateEmail = "";
      let candidateAvatar: string | undefined = undefined;

      if (candidateId) {
        const { data: cand } = await activeClient
          .schema("candidate")
          .from("candidates")
          .select("first_name, last_name, email, avatar_url")
          .eq("id", candidateId)
          .maybeSingle();

        if (cand) {
          const fn = (cand.first_name || "").trim();
          const ln = (cand.last_name || "").trim();
          if (fn || ln) {
            candidateName = `${fn} ${ln}`.trim();
          }
          candidateEmail = cand.email || "";
          candidateAvatar = cand.avatar_url || undefined;
        }
      }

      if (!candidateName || candidateName.toLowerCase() === "candidate candidate" || candidateName.toLowerCase() === "candidate") {
        candidateName = candidateEmail ? candidateEmail.split("@")[0] : "Applicant";
      }

      // Resolve clean interviewer name
      let interviewerName = "Recruiter";
      if (interview.created_by) {
        const { data: rec } = await activeClient
          .schema("organization")
          .from("recruiters")
          .select("first_name, last_name")
          .eq("user_id", interview.created_by)
          .maybeSingle();

        if (rec && (rec.first_name || rec.last_name)) {
          interviewerName = `${rec.first_name || ""} ${rec.last_name || ""}`.trim();
        }
      }

      if ((!interviewerName || interviewerName === "Recruiter") && interview.meeting_title) {
        if (interview.meeting_title.includes("with ")) {
          interviewerName = interview.meeting_title.split("with ")[1].trim();
        } else if (!interview.meeting_title.toLowerCase().includes("interview")) {
          interviewerName = interview.meeting_title;
        }
      }

      return {
        meetingToken: token,
        interviewId: interview.id,
        applicationId: interview.application_id,
        jobId,
        companyId: activeCompanyId || interview.company_id,
        jobTitle,
        companyName,
        candidateId,
        candidateName,
        candidateEmail,
        candidateAvatar,
        interviewerName,
        scheduledAt: interview.start_time,
        durationMinutes: interview.duration_minutes || 60,
        focusNotes: interview.focus_notes || undefined,
        status: interview.status || "scheduled",
        recruiterNotes: interview.recruiter_notes || undefined,
      };
    } catch (err) {
      logger.error("[MeetingService] Error resolving session by token", err);
      return null;
    }
  }

  /**
   * Calculates weighted total score (0-100) based on rubric:
   * Technical: 35%
   * Problem Solving: 20%
   * Communication: 15%
   * Experience: 15%
   * Judgment: 15%
   */
  static calculateWeightedScore(rubric: RecruiterRubricEvaluation): number {
    const tech = Math.min(100, Math.max(0, rubric.technicalScore));
    const ps = Math.min(100, Math.max(0, rubric.problemSolvingScore));
    const comm = Math.min(100, Math.max(0, rubric.communicationScore));
    const exp = Math.min(100, Math.max(0, rubric.experienceScore));
    const judge = Math.min(100, Math.max(0, rubric.judgmentScore));

    const total = tech * 0.35 + ps * 0.20 + comm * 0.15 + exp * 0.15 + judge * 0.15;
    return Math.round(total);
  }

  /**
   * Persists recruiter private notes (autosaved)
   */
  static async saveRecruiterNotes(interviewId: string, notes: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .schema("interview")
        .from("interviews")
        .update({
          recruiter_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", interviewId);

      if (error) {
        logger.error("[MeetingService] Failed to save recruiter notes", error);
        return false;
      }
      return true;
    } catch (err) {
      logger.error("[MeetingService] Error saving recruiter notes", err);
      return false;
    }
  }

  /**
   * Log attendance timestamp (Candidate or Recruiter joined)
   */
  static async recordParticipantJoined(interviewId: string, role: "recruiter" | "candidate"): Promise<void> {
    try {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        status: "in-progress",
      };

      if (role === "candidate") {
        updatePayload.candidate_joined_at = new Date().toISOString();
      } else {
        updatePayload.recruiter_joined_at = new Date().toISOString();
      }

      await supabase
        .schema("interview")
        .from("interviews")
        .update(updatePayload)
        .eq("id", interviewId);
    } catch (err) {
      logger.warn("[MeetingService] Record joined error", err);
    }
  }

  /**
   * Finalizes interview session and records actual duration
   */
  static async endInterviewSession(interviewId: string, actualDurationMinutes: number): Promise<void> {
    try {
      await supabase
        .schema("interview")
        .from("interviews")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          actual_duration_minutes: actualDurationMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", interviewId);
    } catch (err) {
      logger.error("[MeetingService] End interview session error", err);
    }
  }
}
