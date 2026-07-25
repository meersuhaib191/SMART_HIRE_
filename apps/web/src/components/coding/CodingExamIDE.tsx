"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers
} from "lucide-react";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput?: string;
  explanation?: string;
  isSample?: boolean;
  hidden?: boolean;
}

export interface CodingQuestion {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category?: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string | string[];
  examples?: Array<{ input: string; output: string }>;
  testCases: TestCase[];
  allowedLanguages?: string[];
  starterCode?: Record<string, string>;
}

interface CodingExamIDEProps {
  questions: CodingQuestion[];
  durationMinutes: number;
  onSubmit: (submission: {
    solutions: Array<{ questionId: string; code: string; language: string }>;
    timeSpentSeconds: number;
  }) => Promise<void>;
}

const DEFAULT_STARTER_CODE: Record<string, string> = {
  python: `# Complete the solve function below\ndef solve(input_data: str) -> str:\n    # Write your solution logic here\n    return ""\n\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))`,
  javascript: `function solve(input) {\n  // Write your solution logic here\n  return "";\n}\n\nconst fs = require('fs');\nconsole.log(solve(fs.readFileSync(0, 'utf-8')));`,
  typescript: `function solve(input: string): string {\n  // Write your solution logic here\n  return "";\n}\n\nconst fs = require('fs');\nconsole.log(solve(fs.readFileSync(0, 'utf-8')));`,
  cpp: `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    // Write your solution logic here\n    return 0;\n}`,
  java: `import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Write your solution logic here\n    }\n}`,
  csharp: `using System;\n\nclass Solution {\n    static void Main() {\n        // Write your solution logic here\n    }\n}`,
  c: `#include <stdio.h>\n\nint main() {\n    // Write your solution logic here\n    return 0;\n}`
};

export function CodingExamIDE({ questions, durationMinutes, onSubmit }: CodingExamIDEProps) {
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const currentQuestion = questions[currentIdx] || questions[0];

  const [language, setLanguage] = React.useState<string>("python");
  
  // Map of solutions per question ID
  const [solutionsMap, setSolutionsMap] = React.useState<Record<string, { code: string; language: string }>>({});

  const [code, setCode] = React.useState<string>("");
  const [draftNotice, setDraftNotice] = React.useState<string | null>(null);
  
  // Timer state
  const [secondsRemaining, setSecondsRemaining] = React.useState(durationMinutes * 60);
  const [startTime] = React.useState(Date.now());
  
  // Console & Execution State
  const [running, setRunning] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmModal, setConfirmModal] = React.useState(false);
  const [terminalTab, setTerminalTab] = React.useState<"console" | "custom_input">("console");
  const [customInput, setCustomInput] = React.useState<string>("");
  
  const [terminalLogs, setTerminalLogs] = React.useState<string[]>([
    "Monaco Code Editor Environment initialized.",
    `Question ${currentIdx + 1} of ${questions.length} active. Click 'Run Code' to test your solution.`
  ]);
  
  const [runResult, setRunResult] = React.useState<{
    passed: boolean;
    stdout: string;
    stderr: string;
    execTimeMs: number;
    testCaseResults: Array<{ id: string; passed: boolean; input: string; output: string; expected: string; execTimeMs: number }>;
  } | null>(null);

  // Sync active code when question or language changes
  React.useEffect(() => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    const savedForQ = solutionsMap[qId];

    if (savedForQ && savedForQ.language === language && savedForQ.code.trim()) {
      setCode(savedForQ.code);
    } else {
      // UNIVERSAL ZERO-SOLUTION GUARANTEE: Always load clean, unanswered stubs
      const defaultStub = DEFAULT_STARTER_CODE[language] || DEFAULT_STARTER_CODE.python;
      setCode(defaultStub);
    }
  }, [currentQuestion, language]);

  // Save current code into solutionsMap & debounced localStorage draft
  React.useEffect(() => {
    if (!currentQuestion || !code) return;
    const qId = currentQuestion.id;
    
    setSolutionsMap((prev) => ({
      ...prev,
      [qId]: { code, language },
    }));

    const timer = setTimeout(() => {
      const draftKey = `smarthire_coding_draft_${qId}_${language}`;
      localStorage.setItem(draftKey, code);
    }, 800);
    return () => clearTimeout(timer);
  }, [code, language, currentQuestion]);

  // Countdown timer interval
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
  }, [submitting]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRunCode = async () => {
    setRunning(true);
    setTerminalTab("console");
    setTerminalLogs((prev) => [...prev, `\n> Running [${language.toUpperCase()}] code for Problem ${currentIdx + 1} ("${currentQuestion.title}")...`]);

    try {
      const publicCases = (currentQuestion.testCases || []).filter((tc) => !tc.hidden);
      const payloadCases = terminalTab === "custom_input" && customInput.trim()
        ? [{ id: "custom-1", input: customInput.trim(), expectedOutput: "" }]
        : publicCases;

      const res = await fetch("/api/candidate/coding/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          testCases: payloadCases,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution error");

      setRunResult(data);
      setTerminalLogs((prev) => [
        ...prev,
        `✓ Execution Finished in ${data.execTimeMs || 0}ms. Status: ${data.passed ? "PASSED" : "FAILED / WRONG ANSWER"}`
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTerminalLogs((prev) => [...prev, `❌ Execution Failed: ${msg}`]);
    } finally {
      setRunning(false);
    }
  };

  const handleFinalSubmit = async () => {
    setConfirmModal(false);
    if (submitting) return;
    setSubmitting(true);
    const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);

    const submissionPayload = questions.map((q) => {
      const sol = solutionsMap[q.id];
      // CRITICAL: Send empty string for unattempted questions, NOT starter code
      const solCode = sol?.code?.trim() || "";
      return {
        questionId: q.id,
        code: solCode,
        language: sol?.language || language,
      };
    });

    try {
      await onSubmit({
        solutions: submissionPayload,
        timeSpentSeconds,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTerminalLogs((prev) => [...prev, `❌ Submission failed: ${msg}`]);
    } finally {
      setSubmitting(false);
    }
  };

  const getMonacoLanguage = (lang: string) => {
    switch (lang.toLowerCase()) {
      case "python": return "python";
      case "javascript": return "javascript";
      case "typescript": return "typescript";
      case "cpp": return "cpp";
      case "c": return "c";
      case "csharp": return "csharp";
      case "java": return "java";
      default: return "python";
    }
  };

  const allowedLangs = currentQuestion?.allowedLanguages && currentQuestion.allowedLanguages.length > 0
    ? currentQuestion.allowedLanguages
    : ["python", "javascript", "cpp", "java", "csharp", "c"];

  const isFinalQuestion = currentIdx === questions.length - 1;

  return (
    <div className="flex flex-col h-dvh w-dvw bg-zinc-950 text-zinc-100 overflow-hidden select-none font-sans">
      {/* Top Navbar Header */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-blue-400 font-extrabold text-sm tracking-wide">
            <Code className="h-5 w-5 text-blue-500" />
            <span>SmartHire IDE</span>
          </div>
          <span className="text-zinc-600">|</span>

          {/* Multi-Question Selector Pills */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {questions.map((q, idx) => (
              <button
                key={q.id || idx}
                onClick={() => {
                  setCurrentIdx(idx);
                  setRunResult(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentIdx === idx
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                P{idx + 1}
              </button>
            ))}
          </div>

          <h1 className="text-sm font-bold text-zinc-200 truncate max-w-xs">{currentQuestion.title}</h1>
          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
            currentQuestion.difficulty === "easy" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
            currentQuestion.difficulty === "medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
            "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}>
            {currentQuestion.difficulty}
          </span>
          {draftNotice && (
            <span className="text-[11px] text-emerald-400 font-medium animate-pulse bg-emerald-500/10 px-2 py-0.5 rounded">
              {draftNotice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Timer Badge */}
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-amber-400 shadow-inner">
            <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>Time Remaining: {formatTimer(secondsRemaining)} ({durationMinutes}m Total)</span>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/80 rounded-lg px-2 py-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Lang:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-xs font-bold text-blue-400 outline-none cursor-pointer"
            >
              {allowedLangs.map((lang) => (
                <option key={lang} value={lang} className="bg-zinc-900 text-zinc-200">
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Run Code */}
          <button
            onClick={handleRunCode}
            disabled={running || submitting}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all border border-zinc-700 shadow-sm cursor-pointer"
          >
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />}
            <span>Run Code</span>
          </button>

          {/* Navigation Controls */}
          {currentIdx > 0 && (
            <button
              onClick={() => {
                setCurrentIdx((prev) => prev - 1);
                setRunResult(null);
              }}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-zinc-700 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
          )}

          {!isFinalQuestion ? (
            <button
              onClick={() => {
                setCurrentIdx((prev) => prev + 1);
                setRunResult(null);
              }}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
            >
              Next Problem <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setConfirmModal(true)}
              disabled={submitting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-1.5 rounded-lg transition-all shadow-md cursor-pointer animate-pulse"
            >
              {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Submit Exam</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace split */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side: Problem Statement Panel */}
        <div className="w-5/12 min-w-0 border-r border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto p-5 space-y-5 text-left">
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">Problem {currentIdx + 1} of {questions.length}</div>
            <h2 className="text-xl font-black text-white">{currentQuestion.title}</h2>
          </div>

          {/* Problem Description */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-800 pb-2">
              <FileText className="h-4 w-4 text-blue-400" /> Problem Statement
            </h3>
            <div className="text-xs text-zinc-300 leading-relaxed font-normal whitespace-pre-line space-y-2">
              {currentQuestion.description}
            </div>
          </div>

          {/* Input & Output Format */}
          {currentQuestion.inputFormat && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Input Format</h4>
              <p className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 font-mono">{currentQuestion.inputFormat}</p>
            </div>
          )}

          {currentQuestion.outputFormat && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Output Format</h4>
              <p className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 font-mono">{currentQuestion.outputFormat}</p>
            </div>
          )}

          {/* Constraints */}
          {currentQuestion.constraints && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Constraints</h4>
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 text-xs font-mono text-amber-400 space-y-1">
                {Array.isArray(currentQuestion.constraints)
                  ? currentQuestion.constraints.map((c, i) => <div key={i}>• {c}</div>)
                  : <div>• {currentQuestion.constraints}</div>}
              </div>
            </div>
          )}

          {/* Sample Test Cases */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Sample Test Cases
            </h3>
            <div className="space-y-3">
              {(currentQuestion.testCases || []).filter(tc => !tc.hidden).map((tc, idx) => (
                <div key={tc.id || idx} className="bg-zinc-950 rounded-xl border border-zinc-800/90 p-4 space-y-2">
                  <div className="text-[11px] font-bold text-blue-400">Sample Case {idx + 1}</div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 block uppercase">Input:</span>
                    <pre className="text-xs font-mono bg-zinc-900/90 text-zinc-200 p-2 rounded border border-zinc-800 mt-1">{tc.input}</pre>
                  </div>
                  {tc.expectedOutput && (
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 block uppercase">Expected Output:</span>
                      <pre className="text-xs font-mono bg-zinc-900/90 text-emerald-400 p-2 rounded border border-zinc-800 mt-1">{tc.expectedOutput}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Monaco Editor & Terminal */}
        <div className="w-7/12 min-w-0 flex flex-col bg-zinc-950">
          <div className="h-10 bg-zinc-900/90 border-b border-zinc-800 px-4 flex items-center justify-between text-xs font-bold text-zinc-400">
            <div className="flex items-center gap-2 text-zinc-200">
              <Code className="h-4 w-4 text-blue-400" />
              <span>solution.{language === "javascript" ? "js" : language === "python" ? "py" : language === "cpp" ? "cpp" : language === "java" ? "java" : "cs"}</span>
            </div>
            <button
              onClick={() => {
                const starter = currentQuestion.starterCode?.[language] || DEFAULT_STARTER_CODE[language] || DEFAULT_STARTER_CODE.python;
                setCode(starter);
              }}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> Reset Starter Stub
            </button>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 relative min-h-0 overflow-hidden">
            <Editor
              height="100%"
              language={getMonacoLanguage(language)}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                fontSize: 13,
                fontFamily: "Fira Code, Menlo, Monaco, Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: "on",
                lineNumbersMinChars: 3,
                smoothScrolling: true,
              }}
            />
          </div>

          {/* Terminal Console */}
          <div className="h-48 shrink-0 border-t border-zinc-800 bg-zinc-900/90 flex flex-col">
            <div className="h-9 bg-zinc-900 border-b border-zinc-800/80 px-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTerminalTab("console")}
                  className={`text-xs font-bold flex items-center gap-1.5 py-2 border-b-2 cursor-pointer ${
                    terminalTab === "console" ? "text-blue-400 border-blue-500" : "text-zinc-400 border-transparent hover:text-zinc-200"
                  }`}
                >
                  <TerminalIcon className="h-3.5 w-3.5" /> Test Results & Console
                </button>
                <button
                  onClick={() => setTerminalTab("custom_input")}
                  className={`text-xs font-bold flex items-center gap-1.5 py-2 border-b-2 cursor-pointer ${
                    terminalTab === "custom_input" ? "text-blue-400 border-blue-500" : "text-zinc-400 border-transparent hover:text-zinc-200"
                  }`}
                >
                  <Cpu className="h-3.5 w-3.5" /> Custom Input Debugger
                </button>
              </div>

              {runResult && (
                <div className="flex items-center gap-2 text-xs font-bold">
                  {runResult.passed ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> All Sample Cases Passed
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Test Case Failures
                    </span>
                  )}
                  <span className="text-zinc-500">({runResult.execTimeMs}ms)</span>
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-zinc-300 space-y-2 text-left bg-zinc-950">
              {terminalTab === "custom_input" ? (
                <div className="space-y-2">
                  <span className="text-zinc-400 text-[11px] font-bold block uppercase">Custom Input (stdin):</span>
                  <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Enter custom input string..."
                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-zinc-500">Click 'Run Code' to execute solution with this stdin payload.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="whitespace-pre-wrap leading-relaxed">{log}</div>
                  ))}

                  {runResult?.testCaseResults && runResult.testCaseResults.length > 0 && (
                    <div className="pt-2 space-y-2">
                      {runResult.testCaseResults.map((tc, idx) => (
                        <div key={tc.id || idx} className={`p-3 rounded-lg border text-xs ${tc.passed ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-rose-500/10 border-rose-500/20 text-rose-300"}`}>
                          <div className="font-bold flex items-center justify-between">
                            <span>Sample {idx + 1}: {tc.passed ? "ACCEPTED" : "WRONG ANSWER"}</span>
                            <span className="text-[10px] text-zinc-400">{tc.execTimeMs}ms</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-zinc-500 font-bold block">Input:</span>
                              <div className="bg-zinc-950 p-1.5 rounded font-mono text-zinc-200">{tc.input}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500 font-bold block">Expected vs Output:</span>
                              <div className="bg-zinc-950 p-1.5 rounded font-mono text-zinc-200">
                                Exp: <span className="text-emerald-400">{tc.expected}</span> | Act: <span className={tc.passed ? "text-emerald-400" : "text-rose-400"}>{tc.output}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submission Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <Send className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Submit Coding Assessment?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                You have completed viewing all {questions.length} problems. Submitting will evaluate your solutions against server-side hidden test cases.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs py-2.5 rounded-xl border border-zinc-700 transition-all cursor-pointer"
              >
                Review Problems
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
