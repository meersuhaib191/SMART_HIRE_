import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createJobClient } from "@/utils/supabase/job";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { logger } from "@smarthire/logger";
import { executeUniversalCode } from "@/app/api/candidate/coding/run/route";
import { normalizeStdinInput, compareOutputs } from "@/utils/code-comparator";

interface RouteContext {
  params: Promise<{ id: string }>;
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

    const { scheduledTime, assessmentId, durationMinutes, jsonQuestions } = await request.json();
    if (!scheduledTime) {
      return NextResponse.json({ error: "scheduledTime is required" }, { status: 400 });
    }

    if (!Array.isArray(jsonQuestions) || jsonQuestions.length === 0) {
      return NextResponse.json({ error: "At least one valid coding problem must be provided in the JSON payload." }, { status: 400 });
    }

    for (let i = 0; i < jsonQuestions.length; i++) {
      const q = jsonQuestions[i];
      const num = i + 1;
      const title = (q.title || q.name || "").toString().trim();
      const desc = (q.description || q.question_text || q.problem || "").toString().trim();
      if (!title && !desc) {
        return NextResponse.json({ error: `Coding Problem ${num} is missing a valid title or description.` }, { status: 400 });
      }
      const tcs = q.testCases || q.examples;
      if (!Array.isArray(tcs) || tcs.length === 0) {
        return NextResponse.json({ error: `Coding Problem ${num} ("${title || "Untitled"}") must contain at least one test case.` }, { status: 400 });
      }

      for (let j = 0; j < tcs.length; j++) {
        const tc = tcs[j];
        if (tc.input === undefined || tc.input === null || (tc.expectedOutput === undefined && tc.output === undefined)) {
          return NextResponse.json({ error: `Coding Problem ${num}, Test Case ${j + 1} is missing input or expected output.` }, { status: 400 });
        }
      }
    }

    logger.info(`[Coding Scheduler] Recruiter ${user.id} scheduling Coding Assessment for job ${jobId} at ${scheduledTime} with ${jsonQuestions.length} coding problems`);

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

    let finalAssessmentId = assessmentId;
    const finalDuration = durationMinutes ? Number(durationMinutes) : 60;

    const templateTitle = `${job.title} - Coding Assessment`;
    const templateDesc = `Practical multi-problem coding and algorithm evaluation for ${job.title}`;

    const { data: newTpl, error: createTplErr } = await assessmentClient
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
    } else if (job.coding_assessment_id) {
      finalAssessmentId = job.coding_assessment_id;
    } else {
      logger.error("Failed to create coding assessment template", createTplErr);
      return NextResponse.json({ error: "Failed to initialize coding assessment template" }, { status: 500 });
    }

    // 2.5 Validation: Validate test cases and run Reference Solution if provided
    for (let idx = 0; idx < jsonQuestions.length; idx++) {
      const q = jsonQuestions[idx];
      const title = (q.title || q.name || `Problem ${idx + 1}`).toString().trim();
      const rawTestCases = Array.isArray(q.testCases) ? q.testCases : (Array.isArray(q.options?.testCases) ? q.options.testCases : []);

      if (rawTestCases.length === 0) {
        return NextResponse.json({ error: `Problem ${idx + 1} ("${title}") has no test cases configured.` }, { status: 400 });
      }

      for (let tcIdx = 0; tcIdx < rawTestCases.length; tcIdx++) {
        const tc = rawTestCases[tcIdx];
        if (tc.expectedOutput === undefined || tc.expectedOutput === null || String(tc.expectedOutput).trim() === "") {
          return NextResponse.json({ error: `Problem ${idx + 1} ("${title}"), Test Case ${tcIdx + 1} is missing expected output.` }, { status: 400 });
        }
      }

      // Check reference solution if present
      const refSol = q.referenceSolution || q.solution || q.solutionCode || q.referenceSolutions?.python || q.referenceSolutions?.javascript;
      const refLang = q.language || "python";

      if (refSol && typeof refSol === "string" && refSol.trim().length > 10) {
        let failedRefCases = 0;
        for (const tc of rawTestCases) {
          const normInput = normalizeStdinInput(tc.input);
          const expectedStr = String(tc.expectedOutput ?? "").trim();
          const execRes = executeUniversalCode(refSol, refLang, normInput);
          const comp = compareOutputs(execRes.stdout, expectedStr, q.comparisonOptions);
          if (!comp.passed) {
            failedRefCases++;
          }
        }

        if (failedRefCases > 0) {
          return NextResponse.json({
            error: `Assessment validation failed: Reference solution for problem '${title}' failed ${failedRefCases} of ${rawTestCases.length} test cases.`
          }, { status: 400 });
        }
      }
    }

    // 3. Clear previous questions for this assessment template and insert new ones
    await assessmentClient
      .from("questions")
      .delete()
      .eq("assessment_id", finalAssessmentId);

    const rowsToInsert = jsonQuestions.map((q: any, idx: number) => {
      const title = (q.title || q.name || `Problem ${idx + 1}`).toString().trim();
      const desc = (q.description || q.question_text || q.problem || "").toString().trim();
      const inputFormat = (q.inputFormat || q.input_format || "").toString().trim();
      const outputFormat = (q.outputFormat || q.output_format || "").toString().trim();
      const constraints = Array.isArray(q.constraints) ? q.constraints : [String(q.constraints || "")];
      const examples = Array.isArray(q.examples) ? q.examples : [];
      const rawTestCases = Array.isArray(q.testCases) ? q.testCases : (Array.isArray(q.options) ? q.options : []);

      const formattedTestCases = rawTestCases.map((tc: any, tcIdx: number) => ({
        id: tc.id || `tc-${tcIdx + 1}`,
        input: (tc.input ?? "").toString(),
        expectedOutput: (tc.expectedOutput ?? tc.output ?? "").toString(),
        hidden: Boolean(tc.hidden),
        weight: tc.weight ? Number(tc.weight) : 10,
        explanation: tc.explanation || "",
      }));

      const allowedLanguages = Array.isArray(q.allowedLanguages) ? q.allowedLanguages : ["python", "javascript", "cpp", "java", "csharp", "c"];

      // CLEAN UNANSWERED STARTER STUBS (DO NOT PRE-SOLVE THE PROBLEM)
      const cleanStarterStubs: Record<string, string> = {
        python: `# Complete the solve function below\ndef solve(input_data: str) -> str:\n    # Write your solution logic here\n    return ""\n\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))`,
        javascript: `function solve(input) {\n  // Write your solution logic here\n  return "";\n}\n\nconst fs = require('fs');\nconsole.log(solve(fs.readFileSync(0, 'utf-8')));`,
        cpp: `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    // Write your solution logic here\n    return 0;\n}`,
        java: `import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Write your solution logic here\n    }\n}`,
        csharp: `using System;\n\nclass Solution {\n    static void Main() {\n        // Write your solution logic here\n    }\n}`,
        c: `#include <stdio.h>\n\nint main() {\n    // Write your solution logic here\n    return 0;\n}`
      };

      const uploadedSolution = typeof q.starterCode === "string" ? q.starterCode : (q.solution || q.code || "");

      return {
        assessment_id: finalAssessmentId,
        question_text: desc || title,
        question_type: "coding",
        points: q.points ? Number(q.points) : 100,
        difficulty: ["easy", "medium", "hard"].includes(String(q.difficulty).toLowerCase()) ? String(q.difficulty).toLowerCase() : "medium",
        category: "programming",
        options: {
          title,
          description: desc,
          inputFormat,
          outputFormat,
          constraints,
          examples,
          testCases: formattedTestCases,
          allowedLanguages,
          solutionCode: uploadedSolution,
          starterCode: cleanStarterStubs,
        },
      };
    });

    const { error: insErr } = await assessmentClient
      .from("questions")
      .insert(rowsToInsert);

    if (insErr) {
      logger.error("Failed to insert coding problems", insErr);
      return NextResponse.json({ error: `Database error storing coding questions: ${insErr.message}` }, { status: 500 });
    }

    // 4. Update job record
    const { error: updJobErr } = await jobClient
      .from("jobs")
      .update({
        coding_assessment_id: finalAssessmentId,
        coding_scheduled_start_at: scheduledTime,
      })
      .eq("id", jobId);

    if (updJobErr) {
      logger.error("Failed to update job coding schedule", updJobErr);
      return NextResponse.json({ error: "Failed to update job coding schedule" }, { status: 500 });
    }

    // 5. Update active assignments
    const { data: apps } = await appClient
      .from("applications")
      .select("id, candidate_id")
      .eq("job_id", jobId)
      .is("deleted_at", null);

    if (apps && apps.length > 0) {
      for (const app of apps) {
        const { data: existingAssignment } = await assessmentClient
          .from("assignments")
          .select("id")
          .eq("application_id", app.id)
          .eq("assessment_id", finalAssessmentId)
          .maybeSingle();

        if (existingAssignment) {
          await assessmentClient
            .from("assignments")
            .update({
              status: "assigned",
              attempts_count: 0,
              scheduled_start_at: scheduledTime,
              expires_at: new Date(new Date(scheduledTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", existingAssignment.id);

          // Clear previous attempt for clean re-appearance
          await assessmentClient
            .from("attempts")
            .delete()
            .eq("assignment_id", existingAssignment.id);

          // Reset application stage score
          await appClient
            .from("applications")
            .update({ coding_score: null, coding_passed: null })
            .eq("id", app.id);
        } else {
          await assessmentClient
            .from("assignments")
            .insert({
              assessment_id: finalAssessmentId,
              company_id: job.company_id,
              application_id: app.id,
              candidate_id: app.candidate_id,
              scheduled_start_at: scheduledTime,
              expires_at: new Date(new Date(scheduledTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              attempt_limit: 1,
              attempts_count: 0,
              status: "assigned",
            });
        }
      }
    }

    logger.info(`[Coding Scheduler] Successfully configured Coding Assessment for job ${jobId}`);
    return NextResponse.json({ success: true, assessmentId: finalAssessmentId, questionsCount: jsonQuestions.length });
  } catch (err: unknown) {
    logger.error("API error in schedule coding route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Scheduling execution failed", message }, { status: 500 });
  }
}
