/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert";
import { InterviewService } from "../interview-service";
import { interviewRepository } from "../interview-repository";
import { Interview, AvailabilitySlot, Scorecard } from "../interfaces/interview.interface";

// ─────────────────────────────────────────────────────────────────────────────
// Mock UUID Constants
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_INT_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_APP_ID = "00000000-0000-0000-0000-000000000002";
const MOCK_COMP_ID = "00000000-0000-0000-0000-000000000003";
const MOCK_REC_ID = "00000000-0000-0000-0000-000000000004";
const MOCK_PANEL_ID = "00000000-0000-0000-0000-000000000005";
const MOCK_SLOT_ID = "00000000-0000-0000-0000-000000000006";
const MOCK_CAND_ID = "00000000-0000-0000-0000-000000000007";

// ─────────────────────────────────────────────────────────────────────────────
// Business Logic Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockInterview: Interview = {
  id: MOCK_INT_ID,
  applicationId: MOCK_APP_ID,
  companyId: MOCK_COMP_ID,
  meetingTitle: "Technical Coding Round",
  referenceNumber: "INT-1111-AAA",
  type: "Coding",
  roundNumber: 1,
  status: "scheduled",
  startTime: new Date(Date.now() + 3600000).toISOString(), // 1hr from now
  endTime: new Date(Date.now() + 7200000).toISOString(),   // 2hr from now
  timezone: "UTC",
  durationMinutes: 60,
  meetingProviderType: "google_meet",
  meetingLink: "https://meet.google.com/abc-def-ghi",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  interviewers: [
    {
      id: MOCK_PANEL_ID,
      interviewId: MOCK_INT_ID,
      recruiterId: MOCK_REC_ID,
      role: "interviewer",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const mockSlot: AvailabilitySlot = {
  id: MOCK_SLOT_ID,
  recruiterId: MOCK_REC_ID,
  companyId: MOCK_COMP_ID,
  startTime: new Date(Date.now() + 86400000).toISOString(), // 24hr from now
  endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  isBooked: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Override repository methods for unit testing
interviewRepository.checkCandidateOverlap = async () => false;
interviewRepository.checkRecruiterOverlap = async () => false;

interviewRepository.createInterview = async (companyId, data) => {
  return {
    ...mockInterview,
    companyId,
    applicationId: data.applicationId!,
    meetingTitle: data.meetingTitle!,
    referenceNumber: data.referenceNumber,
    type: data.type!,
    roundNumber: data.roundNumber ?? 1,
    startTime: data.startTime!,
    endTime: data.endTime!,
    timezone: data.timezone!,
    durationMinutes: data.durationMinutes!,
    meetingProviderType: data.meetingProviderType!,
    meetingLink: data.meetingLink,
    status: data.status ?? "scheduled",
  };
};

interviewRepository.addInterviewers = async (interviewId, recruiterIds) => {
  return recruiterIds.map((rid) => ({
    id: MOCK_PANEL_ID,
    interviewId,
    recruiterId: rid,
    role: "interviewer",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

interviewRepository.getInterviewById = async (id) => {
  if (id === MOCK_INT_ID) {
    return { ...mockInterview };
  }
  return null;
};

interviewRepository.updateInterview = async (_id, data) => {
  return {
    ...mockInterview,
    ...data,
  } as any;
};

interviewRepository.logInterviewEvent = async () => {};

interviewRepository.getAvailabilitySlotById = async (id) => {
  if (id === MOCK_SLOT_ID) {
    return { ...mockSlot };
  }
  return null;
};

interviewRepository.updateAvailabilitySlotBooking = async () => {};

interviewRepository.createAvailabilitySlot = async (companyId, recruiterId, startTime, endTime) => {
  return {
    id: MOCK_SLOT_ID,
    recruiterId,
    companyId,
    startTime,
    endTime,
    isBooked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

interviewRepository.getAvailabilitySlots = async () => [];

interviewRepository.submitScorecard = async (data: any) => {
  return {
    id: "score-new",
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Scorecard;
};

interviewRepository.updateInterviewerStatus = async () => {};
interviewRepository.getScorecardsForInterview = async () => [];

// ─────────────────────────────────────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────────────────────────────────────

test("Interview Service — Schedule Interview", async () => {
  const interview = await InterviewService.scheduleInterview(MOCK_COMP_ID, {
    applicationId: MOCK_APP_ID,
    meetingTitle: "System Design Round",
    type: "System Design",
    roundNumber: 2,
    startTime: new Date(Date.now() + 3600000).toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(),
    timezone: "Europe/London",
    durationMinutes: 60,
    meetingProviderType: "zoom",
    interviewers: [MOCK_REC_ID],
  });

  assert.strictEqual(interview.meetingTitle, "System Design Round");
  assert.strictEqual(interview.type, "System Design");
  assert.strictEqual(interview.status, "scheduled");
  assert.match(interview.meetingLink ?? "", /zoom\.us/);
  assert.strictEqual(interview.interviewers?.length, 1);
});

test("Interview Service — Schedule Overlaps (Candidate busy)", async () => {
  // Override to simulate overlap
  interviewRepository.checkCandidateOverlap = async () => true;

  await assert.rejects(
    InterviewService.scheduleInterview(MOCK_COMP_ID, {
      applicationId: MOCK_APP_ID,
      meetingTitle: "System Design Round",
      type: "System Design",
      roundNumber: 2,
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      timezone: "Europe/London",
      durationMinutes: 60,
      meetingProviderType: "zoom",
      interviewers: [MOCK_REC_ID],
    }),
    /Candidate already has another interview/
  );

  // Restore
  interviewRepository.checkCandidateOverlap = async () => false;
});

test("Interview Service — Reschedule Interview", async () => {
  const rescheduled = await InterviewService.rescheduleInterview(MOCK_INT_ID, {
    startTime: new Date(Date.now() + 7200000).toISOString(),
    endTime: new Date(Date.now() + 10800000).toISOString(),
    durationMinutes: 60,
  });

  assert.strictEqual(rescheduled.status, "rescheduled");
});

test("Interview Service — Cancel Interview", async () => {
  const cancelled = await InterviewService.cancelInterview(MOCK_INT_ID, "Candidate requested rescheduling");
  assert.strictEqual(cancelled.status, "cancelled");
});

test("Interview Service — Create Recruiter Availability", async () => {
  const slot = await InterviewService.createAvailabilitySlot(MOCK_COMP_ID, MOCK_REC_ID, {
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  });

  assert.strictEqual(slot.recruiterId, MOCK_REC_ID);
  assert.strictEqual(slot.isBooked, false);
});

test("Interview Service — Candidate Booking Slot", async () => {
  const booked = await InterviewService.bookInterviewSlot(MOCK_COMP_ID, MOCK_CAND_ID, {
    slotId: MOCK_SLOT_ID,
    applicationId: MOCK_APP_ID,
    meetingTitle: "Technical Coding Round",
    type: "Coding",
    meetingProviderType: "google_meet",
  });

  assert.strictEqual(booked.status, "confirmed");
  assert.strictEqual(booked.meetingTitle, "Technical Coding Round");
  assert.strictEqual(booked.type, "Coding");
  assert.match(booked.meetingLink ?? "", /meet\.google\.com/);
});

test("Interview Service — Submit Scorecard", async () => {
  const scorecard = await InterviewService.submitScorecard(MOCK_INT_ID, {
    interviewerId: MOCK_PANEL_ID,
    recruiterId: MOCK_REC_ID,
    technicalScore: 4,
    communicationScore: 5,
    problemSolvingScore: 4,
    cultureFitScore: 5,
    confidenceLevel: 4,
    strengths: "Great architecture knowledge",
    weaknesses: "Slightly slow coding speed",
    notes: "Solid candidate, recommend moving to final round",
    recommendation: "hire",
  });

  assert.strictEqual(scorecard.technicalScore, 4);
  assert.strictEqual(scorecard.recommendation, "hire");
});
