"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@smarthire/ui";
import { Plus, Trash2, Loader2, Building, Clipboard } from "lucide-react";
import { logger } from "@smarthire/logger";
import { SkeletonPageHeader, SkeletonCard } from "@/components/shared/Skeleton";

// Use the shared sanitizing client factory (filters out dummy system env vars)
const supabase = createClient();




const sampleMcqTemplate = [
  {
    "questionText": "What is the output of typeof null in JavaScript?",
    "options": ["undefined", "object", "null", "string"],
    "correctAnswer": "object",
    "points": 10,
    "difficulty": "easy",
    "category": "programming"
  },
  {
    "questionText": "Which HTML5 tag is used to display a video?",
    "options": ["<media>", "<video>", "<play>", "<source>"],
    "correctAnswer": "<video>",
    "points": 10,
    "difficulty": "easy",
    "category": "programming"
  }
];

const sampleCodingTemplate = [
  {
    "questionText": "Write a function to check if a number is prime.",
    "correctAnswer": "function isPrime(n) {\n  if (n < 2) return false;\n  for (let i = 2; i <= Math.sqrt(n); i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}"
  },
  {
    "questionText": "Implement binary search algorithm.",
    "correctAnswer": "function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}"
  },
  {
    "questionText": "Design a Least Recently Used (LRU) Cache.",
    "correctAnswer": "class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.cache = new Map();\n  }\n  get(key) {\n    if (!this.cache.has(key)) return -1;\n    const val = this.cache.get(key);\n    this.cache.delete(key);\n    this.cache.set(key, val);\n    return val;\n  }\n  put(key, value) {\n    if (this.cache.has(key)) this.cache.delete(key);\n    this.cache.set(key, value);\n    if (this.cache.size > this.capacity) {\n      this.cache.delete(this.cache.keys().next().value);\n    }\n  }\n}"
  }
];

export default function SettingsPage() {
  const looseParseJSON = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      // Try to parse loose JSON (e.g. single quotes, unquoted keys, trailing commas)
      try {
        const normalized = trimmed
          .replace(/'/g, '"') // Replace single quotes with double quotes
          .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas
        return JSON.parse(normalized);
      } catch {
        // If normalization fails, try parsing using a safe new Function constructor
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
          try {
            const fn = new Function(`return ${trimmed};`);
            return fn();
          } catch (e) {
            logger.debug("looseParseJSON failed", e);
            return null;
          }
        }
      }
    }
    return null;
  };

  const getQuestionCount = (jsonStr: string) => {
    const parsed = looseParseJSON(jsonStr);
    if (parsed && Array.isArray(parsed)) {
      return parsed.length;
    }
    return 0;
  };

  const getMcqTotalPoints = (jsonStr: string) => {
    const parsed = looseParseJSON(jsonStr);
    if (parsed && Array.isArray(parsed)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return parsed.reduce((sum: number, q: any) => sum + (Number(q.points) || 10), 0);
    }
    return 0;
  };

  const [loading, setLoading] = React.useState(true);
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [companyName, setCompanyName] = React.useState("");
  const [companyDomain, setCompanyDomain] = React.useState("");
  const [companyIndustry, setCompanyIndustry] = React.useState("");
  const [companySize, setCompanySize] = React.useState("1-10");
  const [companyDescription, setCompanyDescription] = React.useState("");

  // Options State
  const [departments, setDepartments] = React.useState<{ id: string; name: string }[]>([]);
  const [mcqBanks, setMcqBanks] = React.useState<{ id: string; title: string; questions?: { id: string }[] }[]>([]);
  const [codingTests, setCodingTests] = React.useState<{ id: string; title: string; questions?: { id: string }[] }[]>([]);

  // Form State
  const [newDeptName, setNewDeptName] = React.useState("");
  const [addingDept, setAddingDept] = React.useState(false);
  const [deletingDeptId, setDeletingDeptId] = React.useState<string | null>(null);

  // New MCQ Bank State
  const [newMcqTitle, setNewMcqTitle] = React.useState("");
  const [newMcqDuration, setNewMcqDuration] = React.useState(60);
  const [newMcqJson, setNewMcqJson] = React.useState("");
  const [creatingMcq, setCreatingMcq] = React.useState(false);

  // New Coding Test State
  const [newCodingTitle, setNewCodingTitle] = React.useState("");
  const [newCodingDuration, setNewCodingDuration] = React.useState(60);
  const [newCodingJson, setNewCodingJson] = React.useState("");
  const [creatingCoding, setCreatingCoding] = React.useState(false);
  
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [savingCompany, setSavingCompany] = React.useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = React.useState<string | null>(null);

  const loadSettingsData = React.useCallback(async () => {
    try {
      console.log("loadSettingsData started...");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log("getUser response: user:", user, "error:", userError);
      
      if (userError) {
        setErrorMsg("Failed to authenticate user: " + userError.message);
        return;
      }
      if (!user) {
        setErrorMsg("No user session found! Please log in.");
        return;
      }

      console.log("Fetching recruiter record for user.id:", user.id);
      const { data: recruiter, error: recError } = await supabase
        .schema("organization")
        .from("recruiters")
        .select("company_id, id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      console.log("recruiter record response:", recruiter, "error:", recError);
      if (recError) {
        setErrorMsg("Failed to fetch recruiter profile: " + recError.message);
        return;
      }

      if (recruiter) {
        console.log("Recruiter found! company_id:", recruiter.company_id);
        setCompanyId(recruiter.company_id);

        // Fetch company details
        const { data: comp, error: compError } = await supabase
          .schema("organization")
          .from("companies")
          .select("name, domain, industry, company_size, description")
          .eq("id", recruiter.company_id)
          .maybeSingle();
        
        console.log("company details response:", comp, "error:", compError);
        if (compError) {
          setErrorMsg("Failed to fetch company details: " + compError.message);
          return;
        }

        if (comp) {
          setCompanyName(comp.name || "");
          setCompanyDomain(comp.domain || "");
          setCompanyIndustry(comp.industry || "");
          setCompanySize(comp.company_size || "1-10");
          setCompanyDescription(comp.description || "");
        }

        // Fetch departments list
        const res = await fetch(`/api/organization/departments?companyId=${recruiter.company_id}`);
        if (res.ok) {
          const { data } = await res.json();
          setDepartments(data || []);
        } else {
          console.error("Failed to fetch departments:", res.statusText);
        }

        // Fetch assessments (assessments table with questions count join)
        const { data: templates, error: tempError } = await supabase
          .schema("assessment")
          .from("assessments")
          .select("id, title, description, questions(id)")
          .eq("company_id", recruiter.company_id)
          .is("deleted_at", null);

        if (tempError) {
          console.error("Error fetching templates:", tempError);
          setErrorMsg("Failed to load assessments: " + tempError.message);
          return;
        }

        console.log("Loaded templates:", templates);
        const mcqs = (templates || []).filter((t) => t.description === "mcq_bank");
        const codings = (templates || []).filter((t) => t.description === "coding_test");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMcqBanks(mcqs as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCodingTests(codings as any);
      } else {
        setErrorMsg("No recruiter profile associated with your user account was found.");
      }
    } catch (err) {
      console.error("Failed to load workspace settings:", err);
      logger.error("Failed to load workspace settings", err);
      setErrorMsg("An unexpected error occurred while loading settings: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  // Create new department
  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !companyId) return;
    setAddingDept(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/organization/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: newDeptName.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create department");
      }

      setNewDeptName("");
      // reload departments list
      await loadSettingsData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create department.");
    } finally {
      setAddingDept(false);
    }
  };

  // Delete department
  const handleDeleteDept = async (id: string) => {
    setDeletingDeptId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/organization/departments/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete department");
      }

      await loadSettingsData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete department.");
    } finally {
      setDeletingDeptId(null);
    }
  };

  // Delete MCQ Bank / Coding test template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    setDeletingTemplateId(id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/assessment/templates/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.message ? `${errData.error}: ${errData.message}` : (errData.error || "Failed to delete template");
        throw new Error(msg);
      }

      setSuccessMsg("Template deleted successfully!");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      await loadSettingsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete template.";
      setErrorMsg(msg);
      alert("Error deleting template: " + msg);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setDeletingTemplateId(null);
    }
  };



  const generateUUID = () => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Create new MCQ Bank
  const handleCreateMcqBank = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleCreateMcqBank: newMcqTitle:", newMcqTitle, "companyId:", companyId);
    if (!newMcqTitle.trim() || !companyId) {
      const msg = "Cannot create MCQ Bank: Company ID is not loaded or title is empty.";
      setErrorMsg(msg);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setCreatingMcq(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Parse questions JSON
      let parsedQuestions = [];
      try {
        parsedQuestions = looseParseJSON(newMcqJson) || JSON.parse(newMcqJson.trim() || "[]");
      } catch {
        throw new Error("Invalid JSON syntax in MCQ Questions. Please verify formatting.");
      }

      if (!Array.isArray(parsedQuestions)) {
        throw new Error("MCQ Questions JSON must be a list/array of question objects.");
      }

      // Format and validate MCQ questions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedQuestions = parsedQuestions.map((q: any, index: number) => {
        if (!q.questionText || !q.questionText.trim()) {
          throw new Error(`Question at index ${index} is missing questionText.`);
        }
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw new Error(`Question at index ${index} must have an options array with at least 2 choices.`);
        }
        if (!q.correctAnswer) {
          throw new Error(`Question at index ${index} is missing correctAnswer.`);
        }

        // Format options into object array with id & text
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedOptions = q.options.map((opt: any) => {
          if (typeof opt === "string") {
            return { id: generateUUID(), text: opt.trim() };
          }
          if (typeof opt === "object" && opt.text) {
            return { id: opt.id || generateUUID(), text: opt.text.trim() };
          }
          throw new Error(`Invalid option format in question at index ${index}.`);
        });

        const validCategories = ["programming", "aptitude", "logical-reasoning", "english", "custom"];
        const validDifficulties = ["easy", "medium", "hard"];
        const rawCat = String(q.category || "").trim().toLowerCase();
        const category = validCategories.includes(rawCat) ? rawCat : "programming";
        const rawDiff = String(q.difficulty || "").trim().toLowerCase();
        const difficulty = validDifficulties.includes(rawDiff) ? rawDiff : "medium";

        return {
          questionText: q.questionText.trim(),
          questionType: "mcq",
          correctAnswer: String(q.correctAnswer).trim(),
          points: Number(q.points) || 10,
          difficulty,
          category,
          options: formattedOptions,
        };
      });

      const res = await fetch("/api/v1/assessment/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newMcqTitle.trim(),
          description: "mcq_bank",
          durationMinutes: Number(newMcqDuration) || 60,
          passingPercentage: 60,
          questions: formattedQuestions,
        }),
      });

      console.log("Create MCQ Bank response status:", res.status);
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.message ? `${errData.error}: ${errData.message}` : (errData.error || "Failed to create MCQ bank");
        throw new Error(msg);
      }

      setNewMcqTitle("");
      setNewMcqDuration(60);
      setNewMcqJson("");
      setSuccessMsg("MCQ Bank created successfully!");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      await loadSettingsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create MCQ Bank.";
      setErrorMsg(msg);
      alert("Error creating MCQ Bank: " + msg);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setCreatingMcq(false);
    }
  };

  // Create new Coding Interview Test
  const handleCreateCodingTest = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleCreateCodingTest: newCodingTitle:", newCodingTitle, "companyId:", companyId);
    if (!newCodingTitle.trim() || !companyId) {
      const msg = "Cannot create Coding Test: Company ID is not loaded or title is empty.";
      setErrorMsg(msg);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setCreatingCoding(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Parse questions JSON
      let parsedQuestions = [];
      try {
        parsedQuestions = looseParseJSON(newCodingJson) || JSON.parse(newCodingJson.trim() || "[]");
      } catch {
        throw new Error("Invalid JSON syntax in Coding Questions. Please verify formatting.");
      }

      if (!Array.isArray(parsedQuestions)) {
        throw new Error("Coding Questions JSON must be a list/array of question objects.");
      }

      // Format and validate Coding questions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedQuestions = parsedQuestions.map((q: any, index: number) => {
        if (!q.questionText || !q.questionText.trim()) {
          throw new Error(`Question at index ${index} is missing questionText.`);
        }
        if (!q.correctAnswer) {
          throw new Error(`Question at index ${index} is missing correctAnswer (reference code).`);
        }

        const validCategories = ["programming", "aptitude", "logical-reasoning", "english", "custom"];
        const validDifficulties = ["easy", "medium", "hard"];
        const rawCat = String(q.category || "").trim().toLowerCase();
        const category = validCategories.includes(rawCat) ? rawCat : "programming";
        const rawDiff = String(q.difficulty || "").trim().toLowerCase();
        const defaultDiff = index === 0 ? "easy" : index === 1 ? "medium" : "hard";
        const difficulty = validDifficulties.includes(rawDiff) ? rawDiff : defaultDiff;

        return {
          questionText: q.questionText.trim(),
          questionType: "coding",
          correctAnswer: String(q.correctAnswer).trim(),
          points: Number(q.points) || 100,
          difficulty,
          category,
        };
      });

      const res = await fetch("/api/v1/assessment/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newCodingTitle.trim(),
          description: "coding_test",
          durationMinutes: Number(newCodingDuration) || 60,
          passingPercentage: 60,
          questions: formattedQuestions,
        }),
      });

      console.log("Create Coding Test response status:", res.status);
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.message ? `${errData.error}: ${errData.message}` : (errData.error || "Failed to create coding test");
        throw new Error(msg);
      }

      setNewCodingTitle("");
      setNewCodingDuration(60);
      setNewCodingJson("");
      setSuccessMsg("Coding Interview Test created successfully!");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      await loadSettingsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create Coding Test.";
      setErrorMsg(msg);
      alert("Error creating Coding Test: " + msg);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setCreatingCoding(false);
    }
  };

  // Update workspace settings
  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleUpdateCompany triggered! companyId:", companyId, "companyName:", companyName);
    
    if (!companyId) {
      setErrorMsg("Cannot update settings: companyId is not loaded.");
      return;
    }
    if (!companyName.trim()) {
      setErrorMsg("Company name is required.");
      return;
    }

    setSavingCompany(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      console.log("Fetching PATCH /api/organization/companies/" + companyId);
      const res = await fetch(`/api/organization/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim(),
          domain: companyDomain.trim() || null,
          industry: companyIndustry.trim() || null,
          companySize: companySize || null,
          description: companyDescription.trim() || null,
        }),
      });

      console.log("PATCH response status:", res.status);
      if (!res.ok) {
        const errData = await res.json();
        console.error("PATCH error data:", errData);
        throw new Error(errData.error || "Failed to update workspace settings");
      }

      const resData = await res.json();
      console.log("PATCH success data:", resData);
      setSuccessMsg("Workspace settings updated successfully.");
      await loadSettingsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update workspace settings.";
      console.error("handleUpdateCompany caught error:", err);
      setErrorMsg(msg);
    } finally {
      setSavingCompany(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto py-6 sh-animate-in">
        <SkeletonPageHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto sh-animate-in">
      {/* Header */}
      <div className="flex justify-between items-center text-left border-b border-[#E8E8ED] pb-6">
        <div>
          <span className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider block">
            Organization Console
          </span>
          <h1 className="text-[28px] font-bold text-[#1D1D1F] tracking-tight mt-1">
            Workspace Settings
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-1 font-medium">
            Manage your company departments, review recruiting members, and link templates.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-[12px] bg-[#FFF0EE] border border-[#FFCFCC] p-4 text-[12px] font-semibold text-[#FF3B30] text-left">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-[12px] bg-[#EAFBEE] border border-[#C5F0D2] p-4 text-[12px] font-semibold text-[#1A7F36] text-left">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WORKSPACE DETAILS CARD */}
        <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-6 text-left space-y-5 transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] md:col-span-2">
          <div className="flex items-center gap-2">
            <Building className="h-4.5 w-4.5 text-[#0071E3]" />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Workspace Details</h3>
          </div>

          <form onSubmit={handleUpdateCompany} className="space-y-4 border-t border-[#E8E8ED] pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={savingCompany}
                  required
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">Domain</label>
                <input
                  type="text"
                  value={companyDomain}
                  onChange={(e) => setCompanyDomain(e.target.value)}
                  disabled={savingCompany}
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                  placeholder="e.g. acme.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">Industry</label>
                <input
                  type="text"
                  value={companyIndustry}
                  onChange={(e) => setCompanyIndustry(e.target.value)}
                  disabled={savingCompany}
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                  placeholder="e.g. Software, Healthcare"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">Company Size</label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  disabled={savingCompany}
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                >
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="501-1000">501-1000 employees</option>
                  <option value="1000+">1000+ employees</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">Description</label>
              <textarea
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                disabled={savingCompany}
                rows={3}
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150 resize-none"
                placeholder="Brief description of the company..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingCompany || !companyName.trim()}
                className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-10 px-5 rounded-[12px] text-[13px] font-semibold transition-colors"
              >
                {savingCompany ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* DEPARTMENTS CARD */}
        <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-6 text-left space-y-5 transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2">
            <Building className="h-4.5 w-4.5 text-[#0071E3]" />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Manage Departments</h3>
          </div>

          {/* Add Dept Form */}
          <form onSubmit={handleAddDept} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Sales, Marketing"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              disabled={addingDept}
              className="flex-grow rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
            />
            <Button
              type="submit"
              disabled={addingDept || !newDeptName.trim()}
              className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-10 px-4 rounded-[12px] text-[13px] font-semibold transition-colors shrink-0"
            >
              {addingDept ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add
                </>
              )}
            </Button>
          </form>

          {/* Depts List */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar border-t border-[#E8E8ED] pt-4">
            {departments.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-[12px] border border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2.5"
              >
                <span className="text-[13px] font-semibold text-[#1D1D1F]">{d.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteDept(d.id)}
                  disabled={deletingDeptId === d.id}
                  className="text-[#AEAEB2] hover:text-[#FF3B30] p-1.5 rounded-[8px] hover:bg-black/5 transition-all"
                  title="Delete department"
                >
                  {deletingDeptId === d.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#AEAEB2]" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}

            {departments.length === 0 && (
              <div className="text-center py-6 text-[#AEAEB2] text-[13px] italic">
                No custom departments created yet.
              </div>
            )}
          </div>
        </div>

        {/* MCQ BANKS CARD */}
        <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-6 text-left space-y-4 transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] md:col-span-2">
          <div className="flex items-center gap-2">
            <Clipboard className="h-4.5 w-4.5 text-[#0071E3]" />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">MCQ Banks</h3>
          </div>

          {/* Create MCQ Bank Form */}
          <form onSubmit={handleCreateMcqBank} className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#E8E8ED] pt-4">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block mb-1">Bank Title</label>
              <input
                type="text"
                placeholder="e.g. Web Dev MCQ Questions"
                value={newMcqTitle}
                onChange={(e) => setNewMcqTitle(e.target.value)}
                disabled={creatingMcq}
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block mb-1">Duration (mins)</label>
              <input
                type="number"
                placeholder="Duration"
                value={newMcqDuration || ""}
                onChange={(e) => setNewMcqDuration(Number(e.target.value))}
                disabled={creatingMcq}
                min={5}
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                required
              />
            </div>
            <div className="sm:col-span-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">Questions JSON</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewMcqJson(JSON.stringify(sampleMcqTemplate, null, 2))}
                    className="text-[11px] text-[#0071E3] font-semibold hover:underline text-right"
                  >
                    Load MCQ Template
                  </button>
                  {newMcqJson && (
                    <button
                      type="button"
                      onClick={() => setNewMcqJson("")}
                      className="text-[11px] text-[#FF3B30] font-semibold hover:underline"
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-[11px] bg-[#EAF3FF] border border-[#C5DCFF] text-[#0071E3] rounded-md px-2 py-0.5 font-bold">
                    {getQuestionCount(newMcqJson)} Questions
                  </span>
                  <span className="text-[11px] bg-[#EAFBEE] border border-[#C5F0D2] text-[#1A7F36] rounded-md px-2 py-0.5 font-bold">
                    {getMcqTotalPoints(newMcqJson)} Points
                  </span>
                </div>
              </div>
              <textarea
                placeholder="Paste your questions JSON here, or click 'Load MCQ Template' above..."
                value={newMcqJson}
                onChange={(e) => setNewMcqJson(e.target.value)}
                disabled={creatingMcq}
                rows={5}
                className="w-full font-mono rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[12px] text-[#1D1D1F] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                required
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button
                type="submit"
                disabled={creatingMcq || !newMcqTitle.trim() || !newMcqJson.trim()}
                className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center justify-center gap-1.5 h-10 px-5 rounded-[12px] text-[13px] font-semibold transition-colors"
              >
                {creatingMcq ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Save MCQ Bank
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* MCQ Banks Grid List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#E8E8ED] pt-4">
            {mcqBanks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-[12px] border border-[#E8E8ED] bg-[#F5F5F7] px-4 py-3"
              >
                <span className="text-[13px] font-semibold text-[#1D1D1F] truncate">{t.title}</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#EAFBEE] border border-[#C5F0D2] px-2.5 py-0.5 text-[11px] font-semibold text-[#1A7F36]">
                    {t.questions?.length || 0} Questions
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(t.id)}
                    disabled={deletingTemplateId === t.id}
                    className="p-1 text-[#6E6E73] hover:text-[#FF3B30] rounded-md hover:bg-white border border-transparent hover:border-[#E8E8ED] transition-all duration-150"
                    title="Delete MCQ Bank"
                  >
                    {deletingTemplateId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}

            {mcqBanks.length === 0 && (
              <div className="col-span-2 text-center py-8 text-[#AEAEB2] text-[13px] italic bg-[#F5F5F7] rounded-[12px]">
                No MCQ Banks created yet.
              </div>
            )}
          </div>
        </div>

        {/* CODING INTERVIEW TESTS CARD */}
        <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-6 text-left space-y-4 transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] md:col-span-2">
          <div className="flex items-center gap-2">
            <Clipboard className="h-4.5 w-4.5 text-[#5856D6]" />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Coding Interview Tests</h3>
          </div>

          {/* Create Coding Test Form */}
          <form onSubmit={handleCreateCodingTest} className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#E8E8ED] pt-4">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block mb-1">Test Title</label>
              <input
                type="text"
                placeholder="e.g. Frontend Dev Coding Test"
                value={newCodingTitle}
                onChange={(e) => setNewCodingTitle(e.target.value)}
                disabled={creatingCoding}
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block mb-1">Duration (mins)</label>
              <input
                type="number"
                placeholder="Duration"
                value={newCodingDuration || ""}
                onChange={(e) => setNewCodingDuration(Number(e.target.value))}
                disabled={creatingCoding}
                min={5}
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                required
              />
            </div>
            <div className="sm:col-span-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">Questions JSON (Easy, Medium, Hard)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCodingJson(JSON.stringify(sampleCodingTemplate, null, 2))}
                    className="text-[11px] text-[#5856D6] font-semibold hover:underline"
                  >
                    Load Coding Template
                  </button>
                  {newCodingJson && (
                    <button
                      type="button"
                      onClick={() => setNewCodingJson("")}
                      className="text-[11px] text-[#FF3B30] font-semibold hover:underline"
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-[11px] bg-[#F3F0FF] border border-[#E1D9FF] text-[#5856D6] rounded-md px-2 py-0.5 font-bold">
                    {getQuestionCount(newCodingJson)} Questions
                  </span>
                </div>
              </div>
              <textarea
                placeholder="Paste your questions JSON here, or click 'Load Coding Template' above..."
                value={newCodingJson}
                onChange={(e) => setNewCodingJson(e.target.value)}
                disabled={creatingCoding}
                rows={5}
                className="w-full font-mono rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-[12px] text-[#1D1D1F] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
                required
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button
                type="submit"
                disabled={creatingCoding || !newCodingTitle.trim() || !newCodingJson.trim()}
                className="bg-[#5856D6] hover:bg-[#4F4DBA] text-white flex items-center justify-center gap-1.5 h-10 px-5 rounded-[12px] text-[13px] font-semibold transition-colors"
              >
                {creatingCoding ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Save Coding Test
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Coding Tests Grid List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#E8E8ED] pt-4">
            {codingTests.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-[12px] border border-[#E8E8ED] bg-[#F5F5F7] px-4 py-3"
              >
                <span className="text-[13px] font-semibold text-[#1D1D1F] truncate">{t.title}</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#F3F0FF] border border-[#E1D9FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#5856D6]">
                    {t.questions?.length || 0} Questions
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(t.id)}
                    disabled={deletingTemplateId === t.id}
                    className="p-1 text-[#6E6E73] hover:text-[#FF3B30] rounded-md hover:bg-white border border-transparent hover:border-[#E8E8ED] transition-all duration-150"
                    title="Delete Coding Test"
                  >
                    {deletingTemplateId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}

            {codingTests.length === 0 && (
              <div className="col-span-2 text-center py-8 text-[#AEAEB2] text-[13px] italic bg-[#F5F5F7] rounded-[12px]">
                No Coding Interview Tests created yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
