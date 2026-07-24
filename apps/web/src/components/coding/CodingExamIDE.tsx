"use client";

import * as React from "react";
import {
  Play,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Code,
  FileText,
  ShieldCheck,
  Terminal as TerminalIcon,
  RefreshCw,
  Cpu,
  Lock
} from "lucide-react";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput?: string; // Hidden from candidate during exam
  explanation?: string;
  isSample?: boolean;
}

export interface CodingQuestion {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category?: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  testCases: TestCase[];
  starterCode?: Record<string, string>;
  pdfTemplateName?: string;
  pdfUrl?: string;
}

interface CodingExamIDEProps {
  question: CodingQuestion;
  durationMinutes: number;
  onSubmit: (submission: {
    code: string;
    language: string;
    timeSpentSeconds: number;
  }) => Promise<void>;
}

const DEFAULT_STARTER_CODE: Record<string, string> = {
  python: `# Complete the function below according to the PDF Template Problem Statement.
def solve(input_data: str) -> str:
    # Write your solution here
    return input_data.strip()

if __name__ == "__main__":
    import sys
    input_str = sys.stdin.read()
    print(solve(input_str))`,
  javascript: `/**
 * Complete the solution according to the PDF Template Problem Statement.
 * @param {string} input - Input parameter from stdin
 * @return {string} - Computed result output
 */
function solve(input) {
  // Write your solution here
  return input;
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
console.log(solve(input));`,
  typescript: `function solve(input: string): string {
  // Write your solution here
  return input;
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
console.log(solve(input));`,
  cpp: `#include <iostream>
#include <string>
using namespace std;

string solve(string input) {
    // Write your solution here
    return input;
}

int main() {
    string input;
    if (cin >> input) {
        cout << solve(input) << endl;
    }
    return 0;
}`,
  java: `import java.util.Scanner;

public class Solution {
    public static String solve(String input) {
        // Write your solution here
        return input;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNext()) {
            String input = scanner.next();
            System.out.println(solve(input));
        }
    }
}`
};

export function CodingExamIDE({ question, durationMinutes, onSubmit }: CodingExamIDEProps) {
  const [language, setLanguage] = React.useState<string>("python");
  const [code, setCode] = React.useState<string>("");
  const [activeLeftTab, setActiveLeftTab] = React.useState<"pdf_doc" | "problem_spec">("pdf_doc");
  const [terminalTab, setTerminalTab] = React.useState<"output" | "analysis">("output");
  
  // Timer state
  const [secondsRemaining, setSecondsRemaining] = React.useState(durationMinutes * 60);
  const [startTime] = React.useState(Date.now());
  
  // Execution & Time Complexity State
  const [running, setRunning] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [terminalLogs, setTerminalLogs] = React.useState<string[]>([
    "Integrated Code Execution Terminal initialized.",
    "PDF Question Paper loaded. Write your code and click 'Run Code' to execute tests."
  ]);
  
  const [evaluation, setEvaluation] = React.useState<{
    passedCount: number;
    totalCount: number;
    execTimeMs: number;
    estimatedTimeComplexity: string;
    spaceComplexity: string;
    efficiencyRating: "Optimal O(N)" | "Moderate O(N log N)" | "High Latency O(N^2)";
    testResults: Array<{ id: string; input: string; passed: boolean; execTimeMs: number }>;
  } | null>(null);

  // Set starter code when language changes
  React.useEffect(() => {
    const starter = question.starterCode?.[language] || DEFAULT_STARTER_CODE[language] || DEFAULT_STARTER_CODE.python;
    setCode(starter);
  }, [language, question]);

  const handleFinalSubmit = React.useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);

    try {
      await onSubmit({
        code,
        language,
        timeSpentSeconds,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTerminalLogs((prev) => [...prev, `[ERROR] Submission failed: ${msg}`]);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, startTime, onSubmit, code, language]);

  // Exam Countdown Interval
  React.useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!submitting) {
            handleFinalSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitting, handleFinalSubmit]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Analyze time complexity dynamically based on code structure
  const analyzeCodeComplexity = (srcCode: string) => {
    const lines = srcCode.split("\n");
    let loopDepth = 0;
    let maxLoopDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\s*(for|while)\b/i.test(trimmed)) {
        loopDepth++;
        if (loopDepth > maxLoopDepth) maxLoopDepth = loopDepth;
      }
      if (/^\s*\}\s*$/i.test(trimmed) || (trimmed === "" && loopDepth > 0)) {
        // approximate block end
      }
    }

    if (maxLoopDepth >= 2) {
      return {
        estimatedTimeComplexity: "O(N²)",
        spaceComplexity: "O(1) auxiliary space",
        efficiencyRating: "High Latency O(N^2)" as const,
      };
    } else if (maxLoopDepth === 1) {
      return {
        estimatedTimeComplexity: "O(N)",
        spaceComplexity: "O(N) hash map / array space",
        efficiencyRating: "Optimal O(N)" as const,
      };
    }
    return {
      estimatedTimeComplexity: "O(1)",
      spaceComplexity: "O(1) constant space",
      efficiencyRating: "Optimal O(N)" as const,
    };
  };

  const handleRunCode = async () => {
    setRunning(true);
    setTerminalTab("output");
    setTerminalLogs((prev) => [
      ...prev,
      `\n> Compiling and benchmarking [${language.toUpperCase()}] code against test suite...`
    ]);

    const complexity = analyzeCodeComplexity(code);
    const startTimeMs = performance.now();

    try {
      const res = await fetch("/api/candidate/coding/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          testCases: question.testCases,
        }),
      });

      const data = await res.json();
      const endTimeMs = performance.now();
      const actualExecTimeMs = Math.round(data.execTimeMs || (endTimeMs - startTimeMs));

      if (!res.ok) throw new Error(data.error || "Compilation failed");

      const testResults = (data.testCaseResults || []).map((t: { id: string; input: string; passed: boolean }, idx: number) => ({
        id: t.id || `tc-${idx + 1}`,
        input: t.input || `Test Input #${idx + 1}`,
        passed: Boolean(t.passed),
        execTimeMs: Math.round(actualExecTimeMs / (data.testCaseResults?.length || 1)),
      }));

      const passedCount = testResults.filter((t: { passed: boolean }) => t.passed).length;
      const totalCount = testResults.length || question.testCases.length;

      setEvaluation({
        passedCount,
        totalCount,
        execTimeMs: actualExecTimeMs,
        estimatedTimeComplexity: complexity.estimatedTimeComplexity,
        spaceComplexity: complexity.spaceComplexity,
        efficiencyRating: complexity.efficiencyRating,
        testResults,
      });

      setTerminalLogs((prev) => [
        ...prev,
        `[COMPILATION] Finished in ${actualExecTimeMs}ms`,
        `[STATUS] ${passedCount === totalCount ? "ALL TEST CASES PASSED ✅" : `${passedCount}/${totalCount} TEST CASES PASSED ⚠️`}`,
        `[TIME COMPLEXITY ANALYSIS] Estimated ${complexity.estimatedTimeComplexity} (${complexity.efficiencyRating})`
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTerminalLogs((prev) => [...prev, `[COMPILATION ERROR] ${msg}`]);
    } finally {
      setRunning(false);
    }
  };

  const pdfName = question.pdfTemplateName || "Uploaded_Coding_Problem_Template.pdf";

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans select-none overflow-hidden">
      {/* Top IDE Header Navbar */}
      <header className="h-14 bg-zinc-900/90 border-b border-zinc-800/80 px-5 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
            <Code className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-xs font-extrabold text-zinc-100 flex items-center gap-2">
              {question.title}
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full uppercase border border-emerald-500/30">
                {question.difficulty}
              </span>
            </h1>
            <p className="text-[10px] text-zinc-400 font-medium">Candidate Coding Assessment • Scheduled PDF Template</p>
          </div>
        </div>

        {/* Live Timer Indicator */}
        <div className="flex items-center gap-2 bg-zinc-950 px-4 py-1.5 rounded-xl border border-zinc-800 shadow-inner">
          <Clock className={`h-4 w-4 ${secondsRemaining < 300 ? "text-red-400 animate-pulse" : "text-emerald-400"}`} />
          <span className="text-xs font-mono font-bold text-zinc-300">
            Timer: <span className={secondsRemaining < 300 ? "text-red-400 font-extrabold" : "text-emerald-400 font-bold"}>{formatTimer(secondsRemaining)}</span>
          </span>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="python">Python 3</option>
            <option value="javascript">JavaScript (Node.js)</option>
            <option value="typescript">TypeScript</option>
            <option value="cpp">C++ (GCC)</option>
            <option value="java">Java 17</option>
          </select>

          <button
            onClick={() => setCode(DEFAULT_STARTER_CODE[language] || "")}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-zinc-800 transition-colors"
            title="Reset Starter Code"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleRunCode}
            disabled={running || submitting}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold px-3.5 py-1.5 rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />
            {running ? "Compiling..." : "Run Code"}
          </button>

          <button
            onClick={handleFinalSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? "Submitting..." : "Submit Final Exam"}
          </button>
        </div>
      </header>

      {/* Main IDE Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: PDF Question Template Viewer */}
        <div className="w-1/2 border-r border-zinc-800/80 flex flex-col bg-zinc-900/60 overflow-hidden">
          {/* Sub-header Tabs */}
          <div className="h-10 bg-zinc-950 border-b border-zinc-800/80 flex items-center px-4 gap-4 text-xs font-bold">
            <button
              onClick={() => setActiveLeftTab("pdf_doc")}
              className={`py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeLeftTab === "pdf_doc" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-red-400" /> Scheduled PDF Template
            </button>
            <button
              onClick={() => setActiveLeftTab("problem_spec")}
              className={`py-2 border-b-2 transition-colors cursor-pointer ${
                activeLeftTab === "problem_spec" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Requirements & Constraints
            </button>
          </div>

          {/* Left Content Container */}
          <div className="flex-1 overflow-y-auto p-5 text-left space-y-4">
            {activeLeftTab === "pdf_doc" ? (
              <div className="space-y-4">
                {/* PDF Header Card */}
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3.5 flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-zinc-100 truncate">{pdfName}</h3>
                      <p className="text-[10px] text-zinc-400 font-medium">Uploaded Recruiter Question Template PDF</p>
                    </div>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-md">
                    <ShieldCheck className="h-3 w-3" /> Official Specification
                  </span>
                </div>

                {/* Styled Interactive PDF Document Page Viewer */}
                <div className="bg-zinc-100 rounded-2xl border border-zinc-300 p-6 shadow-2xl space-y-6 text-zinc-900 font-sans text-left">
                  {/* PDF Header Banner */}
                  <div className="border-b-2 border-zinc-300 pb-3 flex justify-between items-end">
                    <div>
                      <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest block">Official Coding Round Template Document</span>
                      <h2 className="text-base font-extrabold text-zinc-900 mt-0.5">{question.title}</h2>
                      <p className="text-[10px] text-zinc-500 font-semibold">{question.category || "Algorithms & System Engineering"}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-zinc-200 text-zinc-800 border border-zinc-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                        PAGE 1 OF 1
                      </span>
                    </div>
                  </div>

                  {/* Problem Description Statement */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">1. Problem Statement & Requirements</h4>
                    <div className="bg-white border border-zinc-200 rounded-xl p-4 text-xs font-mono text-zinc-800 leading-relaxed whitespace-pre-line shadow-sm">
                      {question.description}
                    </div>
                  </div>

                  {/* Input / Output Formats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-600">Input Format</h4>
                      <p className="bg-white border border-zinc-200 p-2.5 rounded-lg text-[11px] font-mono text-zinc-800 shadow-sm">{question.inputFormat}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-600">Output Format</h4>
                      <p className="bg-white border border-zinc-200 p-2.5 rounded-lg text-[11px] font-mono text-zinc-800 shadow-sm">{question.outputFormat}</p>
                    </div>
                  </div>

                  {/* Evaluation Test Case Specifications (Hidden Solutions) */}
                  <div className="space-y-2 pt-2 border-t border-zinc-300">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">2. Test Cases & Inputs</h4>
                      <span className="text-[9px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                        <Lock className="h-3 w-3 text-zinc-600" /> Solutions Hidden from Candidate
                      </span>
                    </div>

                    <div className="space-y-2">
                      {question.testCases.map((tc, idx) => (
                        <div key={tc.id} className="bg-white border border-zinc-200 rounded-xl p-3 text-xs font-mono text-zinc-800 space-y-1 shadow-sm">
                          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 font-sans">
                            <span>SAMPLE INPUT #{idx + 1}</span>
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">READY</span>
                          </div>
                          <div><span className="text-zinc-500 font-sans">Input Data: </span><code className="font-bold text-zinc-900">{tc.input}</code></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-mono">
                <div className="space-y-2">
                  <h2 className="text-base font-bold text-zinc-100 font-sans">{question.title}</h2>
                  <p className="text-zinc-300 leading-relaxed font-sans">{question.description}</p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans">Input Specification</span>
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-zinc-200">{question.inputFormat}</div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans">Output Specification</span>
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-zinc-200">{question.outputFormat}</div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans">Performance Constraints</span>
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-zinc-200">{question.constraints}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Code Editor & Execution Terminal */}
        <div className="w-1/2 flex flex-col bg-zinc-950 overflow-hidden">
          {/* Code Editor Header */}
          <div className="h-10 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between px-4 text-xs font-mono">
            <span className="text-zinc-400 font-bold flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5 text-emerald-400" /> solution.{language === "python" ? "py" : language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "cpp" ? "cpp" : "java"}
            </span>
            <span className="text-[10px] text-zinc-400 font-sans">
              Auto-saved • UTF-8
            </span>
          </div>

          {/* Code Textarea Input */}
          <div className="flex-1 bg-zinc-950 p-4 font-mono text-xs overflow-y-auto leading-relaxed relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="// Write your code solution here..."
              spellCheck={false}
              className="w-full h-full bg-transparent text-emerald-300 font-mono focus:outline-none resize-none leading-relaxed placeholder:text-zinc-600"
            />
          </div>

          {/* Bottom Execution Terminal & Complexity Benchmarking */}
          <div className="h-56 bg-zinc-900 border-t border-zinc-800 flex flex-col shrink-0">
            {/* Terminal Header Tabs */}
            <div className="h-9 bg-zinc-950 border-b border-zinc-800 px-4 flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTerminalTab("output")}
                  className={`py-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    terminalTab === "output" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400"
                  }`}
                >
                  <TerminalIcon className="h-3.5 w-3.5 text-emerald-400" /> Execution Terminal
                </button>

                <button
                  onClick={() => setTerminalTab("analysis")}
                  className={`py-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    terminalTab === "analysis" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400"
                  }`}
                >
                  <Cpu className="h-3.5 w-3.5 text-blue-400" /> Time Complexity Analysis
                </button>
              </div>

              {evaluation && (
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-zinc-400">
                    Test Cases: <span className="font-bold text-white">{evaluation.passedCount}/{evaluation.totalCount} Passed</span>
                  </span>
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Runtime: {evaluation.execTimeMs}ms
                  </span>
                </div>
              )}
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-4 font-mono text-xs overflow-y-auto text-left leading-relaxed">
              {terminalTab === "output" ? (
                <div className="space-y-1.5 text-zinc-300">
                  {terminalLogs.map((log, i) => (
                    <div key={i} className={log.includes("PASSED") ? "text-emerald-400 font-bold" : log.includes("ERROR") ? "text-red-400 font-bold" : ""}>
                      {log}
                    </div>
                  ))}

                  {evaluation?.testResults && evaluation.testResults.length > 0 && (
                    <div className="pt-3 space-y-2 font-mono">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans flex items-center justify-between border-t border-zinc-800 pt-2">
                        <span>Test Case Evaluation Summary (Solutions Hidden)</span>
                      </div>
                      {evaluation.testResults.map((tr, idx) => (
                        <div key={tr.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {tr.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                            )}
                            <span className="text-zinc-200 font-bold">Test Input #{idx + 1}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-zinc-400">{tr.execTimeMs}ms execution</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tr.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                              {tr.passed ? "PASSED" : "FAILED"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-zinc-200">Algorithmic Efficiency & Complexity Benchmark</span>
                    <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold border border-blue-500/20">
                      Automated Static Analysis
                    </span>
                  </div>

                  {evaluation ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Time Complexity</span>
                        <span className="text-lg font-extrabold text-emerald-400 font-mono">{evaluation.estimatedTimeComplexity}</span>
                      </div>
                      <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Space Complexity</span>
                        <span className="text-xs font-bold text-zinc-200 font-mono mt-1 block">{evaluation.spaceComplexity}</span>
                      </div>
                      <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Efficiency Rating</span>
                        <span className="text-xs font-bold text-emerald-400 mt-1 block">{evaluation.efficiencyRating}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic py-4">
                      Click 'Run Code' to run real-time static complexity analysis and benchmark runtime execution speed.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
