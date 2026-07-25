"use client";

import * as React from "react";
import {
  Sparkles,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  TrendingUp,
  RefreshCw,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@smarthire/ui";
import { AtsScoreBreakdown } from "@/services/ats/ats-engine";

export function AtsCalculatorCard() {
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);
  const [resumeText, setResumeText] = React.useState("");
  const [jdFile, setJdFile] = React.useState<File | null>(null);
  const [jdText, setJdText] = React.useState("");
  const [inputMode, setInputMode] = React.useState<"file" | "text">("file");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AtsScoreBreakdown | null>(null);
  const [aiSuggestions, setAiSuggestions] = React.useState<any | null>(null);

  const handleResetAll = () => {
    setResumeFile(null);
    setResumeText("");
    setJdFile(null);
    setJdText("");
    setResult(null);
    setAiSuggestions(null);
    setError(null);
    if (typeof document !== "undefined") {
      const resumeInput = document.getElementById("resume-file-input") as HTMLInputElement;
      if (resumeInput) resumeInput.value = "";
      const jdInput = document.getElementById("jd-file-input") as HTMLInputElement;
      if (jdInput) jdInput.value = "";
    }
  };

  const handleModeSwitch = (mode: "file" | "text") => {
    if (mode !== inputMode) {
      setInputMode(mode);
      handleResetAll();
    }
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (inputMode === "file") {
      if (!resumeFile && !resumeText.trim()) {
        setError("Please select a candidate resume document (.pdf, .docx, .txt).");
        return;
      }
      if (!jdFile && !jdText.trim()) {
        setError("Please select a target job description document (.pdf, .docx, .txt).");
        return;
      }
    } else {
      if (!resumeText.trim()) {
        setError("Please paste candidate resume text.");
        return;
      }
      if (!jdText.trim()) {
        setError("Please paste target job description text.");
        return;
      }
    }

    setLoading(true);

    try {
      const formData = new FormData();
      if (resumeFile) formData.append("resumeFile", resumeFile);
      if (resumeText.trim()) formData.append("resumeText", resumeText.trim());
      if (jdFile) formData.append("jdFile", jdFile);
      if (jdText.trim()) formData.append("jdText", jdText.trim());

      const res = await fetch("/api/candidate/ats-calculator", {
        method: "POST",
        body: formData,
      });

      let data: any = null;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!res.ok) {
          throw new Error(`Server returned error status ${res.status}: ${res.statusText || "Internal Server Error"}`);
        }
        throw new Error("Unable to parse document response. Please ensure your uploaded file contains readable text.");
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || "Failed to calculate ATS score.");
      }

      setResult(data.result);
      if (data.aiSuggestions) {
        setAiSuggestions(data.aiSuggestions);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ATS Score calculation failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-md p-6 space-y-6 text-left relative overflow-hidden">
      {/* Decorative Gradient Line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">AI Powered Tool</span>
          <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
            ATS Resume & JD Match Calculator
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Upload your Resume Document (PDF, DOCX, JSON, TXT) & Target Job Description to compute real-time ATS match score & actionable optimization tips.
          </p>
        </div>

        {/* Input Mode Toggle & Refresh Button */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {(resumeFile || jdFile || resumeText || jdText || result) && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-bold transition-all cursor-pointer"
              title="Reset & refresh all inputs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}

          <div className="flex items-center bg-zinc-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleModeSwitch("file")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                inputMode === "file" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Document Upload
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                inputMode === "text" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Paste Raw Text
            </button>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleCalculate} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            {error}
          </div>
        )}

        {inputMode === "file" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Resume Upload Box */}
            <div className="border-2 border-dashed border-zinc-200 hover:border-blue-500 transition-colors rounded-2xl p-5 text-center space-y-2 bg-zinc-50/50">
              <Upload className="h-6 w-6 text-blue-600 mx-auto" />
              <div className="space-y-0.5">
                <span className="text-xs font-extrabold text-zinc-900 block">Candidate Resume Document</span>
                <span className="text-[10px] text-zinc-500 font-medium block">Upload resume (.pdf, .docx, .json, .txt, .doc)</span>
              </div>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.json,.md,.csv,.rtf"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="hidden"
                id="resume-file-input"
              />
              <label
                htmlFor="resume-file-input"
                className="inline-block bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-300 shadow-2xs cursor-pointer transition-all"
              >
                {resumeFile ? resumeFile.name : "Choose File"}
              </label>
            </div>

            {/* Job Description Upload Box */}
            <div className="border-2 border-dashed border-zinc-200 hover:border-indigo-500 transition-colors rounded-2xl p-5 text-center space-y-2 bg-zinc-50/50">
              <FileText className="h-6 w-6 text-indigo-600 mx-auto" />
              <div className="space-y-0.5">
                <span className="text-xs font-extrabold text-zinc-900 block">Target Job Description Document</span>
                <span className="text-[10px] text-zinc-500 font-medium block">Upload target JD (.pdf, .docx, .json, .txt, .doc)</span>
              </div>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.json,.md,.csv,.rtf"
                onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                className="hidden"
                id="jd-file-input"
              />
              <label
                htmlFor="jd-file-input"
                className="inline-block bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-300 shadow-2xs cursor-pointer transition-all"
              >
                {jdFile ? jdFile.name : "Choose File"}
              </label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="resume-text-area" className="text-xs font-extrabold text-zinc-700 block">Paste Resume Text</label>
              <textarea
                id="resume-text-area"
                rows={5}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste candidate resume text..."
                className="w-full rounded-2xl border border-zinc-300 p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="jd-text-area" className="text-xs font-extrabold text-zinc-700 block">Paste Job Description Text</label>
              <textarea
                id="jd-text-area"
                rows={5}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste target job description text..."
                className="w-full rounded-2xl border border-zinc-300 p-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                Calculating ATS Score & AI Guidance...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 text-amber-300 fill-amber-300" />
                Calculate ATS Match Score <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* RESULT SECTION */}
      {result && (
        <div className="border-t border-zinc-100 pt-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Main Score Display Banner (NO CONFIDENCE METRIC) */}
          <div className="bg-gradient-to-br from-zinc-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">Extracted ATS Result</span>
              <h3 className="text-2xl font-black tracking-tight">Overall ATS Score: {result.atsScore}%</h3>
              <p className="text-xs text-blue-200 font-medium max-w-md">
                Multi-factor score evaluated across skills, semantic alignment, experience, and text similarity.
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Match Status</span>
                <span className={`inline-block mt-1 text-xs font-black px-3.5 py-1.5 rounded-full ${
                  result.passed ? "bg-emerald-500 text-white shadow-md" : "bg-amber-500 text-white"
                }`}>
                  {result.passed ? "✓ High Match Potential" : "⚠ Needs Optimization"}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Feature Component Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-800">Skills Overlap (45% Weight)</span>
                <span className="text-blue-600">{Math.round(result.features.skillOverlap * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.round(result.features.skillOverlap * 100)}%` }} />
              </div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-800">Semantic Alignment (30% Weight)</span>
                <span className="text-emerald-600">{Math.round(result.features.semanticSimilarity * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.round(result.features.semanticSimilarity * 100)}%` }} />
              </div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-800">Experience Match (15% Weight)</span>
                <span className="text-purple-600">{Math.round(result.features.experienceScore * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full" style={{ width: `${Math.round(result.features.experienceScore * 100)}%` }} />
              </div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-800">Text N-Gram Similarity (10% Weight)</span>
                <span className="text-amber-600">{Math.round(result.features.textSimilarity * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-600 rounded-full" style={{ width: `${Math.round(result.features.textSimilarity * 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Matched vs Missing Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Matched Required Skills ({result.matchedSkills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.matchedSkills.map((s) => (
                  <span key={s} className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {result.missingSkills.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Missing Job Requirements ({result.missingSkills.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.missingSkills.map((s) => (
                    <span key={s} className="bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gemini AI Recommendations Section */}
          {aiSuggestions && (
            <div className="space-y-4 pt-2">
              {!aiSuggestions.available ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  AI resume suggestions are temporarily unavailable. Your ATS analysis is still available below.
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-200/80 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-200/60 pb-2">
                    <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
                    Gemini AI Resume Improvement Guidance
                  </h4>

                  {aiSuggestions.strengths?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block">Strong Resume Matches:</span>
                      <ul className="space-y-1 text-xs text-zinc-700 font-medium pl-2">
                        {aiSuggestions.strengths.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold shrink-0">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSuggestions.missingSkills?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide block">Skills Gaps & Non-Fabrication Guidance:</span>
                      <ul className="space-y-1 text-xs text-zinc-700 font-medium pl-2">
                        {aiSuggestions.missingSkills.map((gap: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-600 font-bold shrink-0">⚠</span> {gap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSuggestions.experienceAlignment?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide block">Work Experience Alignment:</span>
                      <ul className="space-y-1 text-xs text-zinc-700 font-medium pl-2">
                        {aiSuggestions.experienceAlignment.map((exp: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-purple-600 font-bold shrink-0">•</span> {exp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSuggestions.projectRecommendations?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide block">Project Recommendations:</span>
                      <ul className="space-y-1 text-xs text-zinc-700 font-medium pl-2">
                        {aiSuggestions.projectRecommendations.map((proj: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-indigo-600 font-bold shrink-0">•</span> {proj}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSuggestions.resumeImprovements?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide block">Actionable Resume Improvements:</span>
                      <ul className="space-y-1 text-xs text-zinc-700 font-medium pl-2">
                        {aiSuggestions.resumeImprovements.map((imp: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold shrink-0">•</span> {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mandatory Disclaimer Wording */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
            <p className="text-[11px] text-zinc-500 font-medium italic">
              💡 <span className="font-bold">Notice:</span> This analysis estimates resume-to-job alignment and is intended as guidance. Actual recruiter decisions may consider additional factors.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
