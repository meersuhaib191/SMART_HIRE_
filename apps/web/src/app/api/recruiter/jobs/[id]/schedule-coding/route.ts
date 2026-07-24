import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createJobClient } from "@/utils/supabase/job";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { NotificationService } from "@/services/notification";
import { logger } from "@smarthire/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function generateProfessionalCodingQuestion(title: string, desc: string) {
  const combined = `${title} ${desc}`.toLowerCase();
  const isFrontend = /react|next|frontend|ui|css|javascript|typescript/i.test(combined);
  const isPythonData = /python|data|django|fastapi|ai|machine learning|analytics/i.test(combined);

  if (isFrontend) {
    return {
      title: `${title} - Asynchronous Concurrent Task Runner`,
      question_text: `Design and implement an Asynchronous Task Queue in JavaScript/TypeScript or Python that processes up to K tasks concurrently.

### Problem Description
Given an array of async task functions and a maximum concurrency limit \`K\`, execute all tasks such that no more than K tasks run simultaneously. Return an array of completed result values in the original input order.

### Constraints
- 1 <= tasks.length <= 10^4
- 1 <= K <= 100
- Total execution time must be optimized O(N / K).

### Example 1
Input: tasks = [task1, task2, task3], K = 2
Output: [res1, res2, res3]`,
      category: "Frontend Engineering & Async Control Flow",
      difficulty: "medium",
      options: [
        { id: "tc-1", input: "tasks=[100ms, 200ms, 50ms], K=2", expectedOutput: "[100ms, 200ms, 50ms]", isSample: true },
        { id: "tc-2", input: "tasks=[10ms, 10ms], K=1", expectedOutput: "[10ms, 10ms]", isSample: true }
      ]
    };
  } else if (isPythonData) {
    return {
      title: `${title} - Sliding Window Maximum Latency Aggregator`,
      question_text: `Given a continuous stream of real-time latency metrics and a sliding window size \`K\`, write an algorithm to find the maximum metric value in each window.

### Problem Description
You are given an array of integers \`nums\` representing stream metrics and an integer \`K\`. There is a sliding window of size K moving from left to right. Return the max value in each window state.

### Constraints
- 1 <= nums.length <= 10^5
- 1 <= K <= nums.length
- Expected Time Complexity: O(N) using a Monotonic Deque.

### Example 1
Input: nums = [1,3,-1,-3,5,3,6,7], K = 3
Output: [3,3,5,5,6,7]`,
      category: "Data Structures & Stream Processing",
      difficulty: "medium",
      options: [
        { id: "tc-1", input: "1 3 -1 -3 5 3 6 7\n3", expectedOutput: "3 3 5 5 6 7", isSample: true },
        { id: "tc-2", input: "1\n1", expectedOutput: "1", isSample: true }
      ]
    };
  } else {
    return {
      title: `${title} - Least Recently Used (LRU) Cache Implementation`,
      question_text: `Design a data structure that follows the constraints of a Least Recently Used (LRU) Cache.

### Problem Description
Implement the LRUCache class:
- \`LRUCache(int capacity)\` Initialize the LRU cache with positive size capacity.
- \`int get(int key)\` Return the value of the key if key exists, otherwise return -1.
- \`void put(int key, int value)\` Update or insert value if key exists; if key limit reached, evict least recently used item.

### Constraints
- 1 <= capacity <= 3000
- 0 <= key, value <= 10^4
- Both get and put must operate in O(1) average time complexity.`,
      category: "Algorithms & Systems Architecture",
      difficulty: "hard",
      options: [
        { id: "tc-1", input: "capacity=2, put(1,1), put(2,2), get(1), put(3,3), get(2)", expectedOutput: "1, -1", isSample: true }
      ]
    };
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: jobId } = await context.params;
    const appClient = await createAppClient();
    const jobClient = await createJobClient();
    const assessmentClient = await createAssessmentClient();

    // 1. Authenticate recruiter session
    const {
      data: { user },
      error: authError,
    } = await appClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { scheduledTime, assessmentId, templateFileName, durationMinutes } = await request.json();
    if (!scheduledTime) {
      return NextResponse.json({ error: "scheduledTime is required" }, { status: 400 });
    }

    logger.info(`[Coding Scheduler] Recruiter ${user.id} scheduling Coding round for job ${jobId} at ${scheduledTime} with PDF template: ${templateFileName || "default"}`);

    // 2. Fetch job posting details
    const { data: job, error: jobErr } = await jobClient
      .from("jobs")
      .select("title, company_id, coding_assessment_id, description")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      logger.error("Failed to fetch job details for coding scheduling", jobErr);
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    let finalAssessmentId = assessmentId || job.coding_assessment_id;
    const finalDuration = durationMinutes ? Number(durationMinutes) : 30;

    if (templateFileName || !finalAssessmentId) {
      const qData = generateProfessionalCodingQuestion(job.title, job.description || "");

      const templateTitle = `${job.title} - Coding Interview Assessment`;
      const templateDesc = `Coding evaluation round for ${job.title}`;

      const { data: newTpl } = await assessmentClient
        .from("assessments")
        .insert({
          company_id: job.company_id,
          title: templateTitle,
          description: templateDesc,
          duration_minutes: finalDuration,
          passing_percentage: 60,
          status: "published",
        })
        .select("id")
        .maybeSingle();

      if (newTpl) {
        finalAssessmentId = newTpl.id;

        await assessmentClient
          .from("questions")
          .insert({
            assessment_id: newTpl.id,
            question_text: qData.question_text,
            question_type: "coding",
            points: 10,
            difficulty: qData.difficulty,
            category: qData.category,
            options: qData.options,
          });
      }
    }

    if (!finalAssessmentId) {
      return NextResponse.json({ error: "Could not auto-assign a coding assessment template" }, { status: 500 });
    }

    // 3. Update job with coding assessment template and scheduled start time
    const { error: updJobErr } = await jobClient
      .from("jobs")
      .update({
        coding_assessment_id: finalAssessmentId,
        coding_scheduled_start_at: scheduledTime,
      })
      .eq("id", jobId);

    if (updJobErr) {
      logger.error("Failed to update job coding schedule details", updJobErr);
      return NextResponse.json({ error: `Failed to update job coding schedule: ${updJobErr.message}` }, { status: 500 });
    }

    // 4. Fetch all active applications for this job posting
    const { data: apps, error: appsErr } = await appClient
      .from("applications")
      .select("id, candidate_id, status")
      .eq("job_id", jobId)
      .is("deleted_at", null);

    if (appsErr) {
      logger.error("Failed to fetch coding stage applications for scheduling assignments", appsErr);
      return NextResponse.json({ error: "Database error fetching applications" }, { status: 500 });
    }

    // 5. Create / Update assignments for candidates & send notifications
    if (apps && apps.length > 0) {
      const formattedDate = new Date(scheduledTime).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
      });

      for (const app of apps) {
        const candidateProfileId = app.candidate_id;

        // Fetch candidate profile to get user_id & email for notifications
        const { data: cand } = await appClient
          .schema("candidate")
          .from("candidates")
          .select("user_id, email, first_name")
          .eq("id", candidateProfileId)
          .maybeSingle();

        // Check if assignment exists
        const { data: existingAssignment } = await assessmentClient
          .from("assignments")
          .select("id")
          .eq("application_id", app.id)
          .eq("assessment_id", finalAssessmentId)
          .maybeSingle();

        let assignmentId = existingAssignment?.id;

        if (existingAssignment) {
          await assessmentClient
            .from("assignments")
            .update({
              scheduled_start_at: scheduledTime,
              expires_at: new Date(new Date(scheduledTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", existingAssignment.id);
        } else {
          const { data: newAssignment, error: insErr } = await assessmentClient
            .from("assignments")
            .insert({
              assessment_id: finalAssessmentId,
              company_id: job.company_id,
              application_id: app.id,
              candidate_id: candidateProfileId,
              scheduled_start_at: scheduledTime,
              expires_at: new Date(new Date(scheduledTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              attempt_limit: 1,
              attempts_count: 0,
              status: "assigned",
            })
            .select("id")
            .maybeSingle();

          if (insErr) {
            logger.error("Failed to insert coding assignment", insErr);
          }

          assignmentId = newAssignment?.id;
        }

        // Send Selection & Scheduling Notification if user_id present
        if (cand?.user_id) {
          try {
            await NotificationService.send({
              userId: cand.user_id,
              templateId: "application.status_updated",
              channels: ["in_app"],
              recipientEmail: cand.email || undefined,
              metadata: { assignmentId },
              variables: {
                candidateName: cand.first_name || "Candidate",
                jobTitle: job.title,
                companyName: "Smart Hire",
                newStatus: `Coding Interview Round (Scheduled: ${formattedDate})`,
              },
            });
          } catch (notifErr) {
            logger.error(`Failed to send coding round notification to user ${cand.user_id}`, notifErr);
          }
        }
      }
    }

    return NextResponse.json({ success: true, count: apps?.length || 0 });
  } catch (err: unknown) {
    logger.error("API error in schedule coding route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Coding scheduling execution failed", message }, { status: 500 });
  }
}
