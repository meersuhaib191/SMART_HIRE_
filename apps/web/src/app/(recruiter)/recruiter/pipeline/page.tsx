"use client";

import * as React from "react";
import { ApplicationCard, CandidateDrawer, PipelineFilters, MetricsBar, CandidateAppCard } from "@/components/pipeline";
import { FullScreenCandidateModal, CandidateApplicationModalData } from "@/components/pipeline/FullScreenCandidateModal";
import { ScheduleFinalInterviewModal } from "@/components/interview/ScheduleFinalInterviewModal";
import { logger } from "@smarthire/logger";
import { isTechDomain } from "@/utils/domain-utils";
import { SkeletonMetric, SkeletonCard } from "@/components/shared/Skeleton";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Loader2, Briefcase, Video, UserCheck, Calendar, Clock, UploadCloud, FileText, X, FileCheck, Sparkles, BarChart3, FileCode, Edit, Lock } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/use-notifications";
import { UnreadDot } from "@/components/shared/UnreadDot";

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
  { key: "zoom_interview", name: "6. Recruiter Final Interview" },
  { key: "offer_sent", name: "7. Offer" },
  { key: "hired", name: "8. Hired / Joined" },
];

const nonTechColumns = [
  { key: "applied", name: "1. Applied" },
  { key: "screening", name: "2. ATS Screened" },
  { key: "mcq", name: "3. MCQ Exam" },
  { key: "interview", name: "4. AI Interview" },
  { key: "zoom_interview", name: "5. Recruiter Final Interview" },
  { key: "offer_sent", name: "6. Offer" },
  { key: "hired", name: "7. Hired / Joined" },
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
  const router = useRouter();
  const { hasUnreadForContext, markContextAsRead } = useNotifications();
  const [cards, setCards] = React.useState<CandidateAppCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedJobId, setSelectedJobId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [jobs, setJobs] = React.useState<{ id: string; title: string }[]>([]);

  // Drawer detail state
  const [activeCard, setActiveCard] = React.useState<CandidateAppCard | null>(null);
  const [screeningLoading, setScreeningLoading] = React.useState(false);
  const [topNLimit, setTopNLimit] = React.useState(5);
  const [stageTopNMap, setStageTopNMap] = React.useState<Record<string, number>>({
    screening: 5,
    mcq: 5,
    coding: 5,
    interview: 5,
  });

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

const DOMAIN_QUESTION_PRESETS: Record<string, { label: string; description: string; questions: any[] }> = {
  software_tech: {
    label: "Software Engineering & Tech (10 Questions)",
    description: "System architecture, DS & Algorithms, REST APIs, Git & Concurrency",
    questions: [
      {
        questionText: "What is the worst-case time complexity of accessing an element by index in an array?",
        options: ["O(1)", "O(N)", "O(log N)", "O(N^2)"],
        correctAnswer: "O(1)",
        points: 2,
        category: "Data Structures",
      },
      {
        questionText: "Which HTTP status code is returned for a successful resource creation via POST?",
        options: ["201 Created", "200 OK", "204 No Content", "302 Found"],
        correctAnswer: "201 Created",
        points: 2,
        category: "Web APIs",
      },
      {
        questionText: "In relational database design, what is the primary purpose of a Foreign Key?",
        options: ["Enforce referential integrity between tables", "Encrypt data on disk", "Speed up full text search", "Compress table backups"],
        correctAnswer: "Enforce referential integrity between tables",
        points: 2,
        category: "Databases",
      },
      {
        questionText: "Which design pattern ensures a class has only one instance and provides a global point of access?",
        options: ["Singleton Pattern", "Factory Pattern", "Observer Pattern", "Strategy Pattern"],
        correctAnswer: "Singleton Pattern",
        points: 2,
        category: "Design Patterns",
      },
      {
        questionText: "What is the main benefit of deploying static assets to a Content Delivery Network (CDN)?",
        options: ["Serve content from edge servers physically closer to end users", "Execute backend SQL database queries", "Generate JWT tokens", "Compile TypeScript"],
        correctAnswer: "Serve content from edge servers physically closer to end users",
        points: 2,
        category: "Infrastructure",
      },
      {
        questionText: "Which HTTP method should be strictly idempotent when updating a full resource?",
        options: ["PUT", "POST", "PATCH", "DELETE"],
        correctAnswer: "PUT",
        points: 2,
        category: "Web APIs",
      },
      {
        questionText: "What does ACID stand for in database transaction properties?",
        options: ["Atomicity, Consistency, Isolation, Durability", "Availability, Consistency, Integration, Performance", "Asynchronous, Concurrent, Isolated, Distributed", "Automated, Checked, Indexed, Duplicated"],
        correctAnswer: "Atomicity, Consistency, Isolation, Durability",
        points: 2,
        category: "Databases",
      },
      {
        questionText: "What is the primary operational objective of CI/CD deployment pipelines?",
        options: ["Automate building, testing, and releasing software reliably", "Eliminate code version control", "Reduce network bandwidth", "Manually edit DB tables"],
        correctAnswer: "Automate building, testing, and releasing software reliably",
        points: 2,
        category: "DevOps",
      },
      {
        questionText: "In JavaScript, what is the value of typeof NaN?",
        options: ["number", "undefined", "object", "string"],
        correctAnswer: "number",
        points: 2,
        category: "JavaScript",
      },
      {
        questionText: "Which data structure operates on a First-In, First-Out (FIFO) principle?",
        options: ["Queue", "Stack", "Binary Tree", "Max Heap"],
        correctAnswer: "Queue",
        points: 2,
        category: "Data Structures",
      },
    ],
  },
  data_science: {
    label: "Data Science & Analytics (8 Questions)",
    description: "Python, SQL, Probability, Machine Learning & Data Preprocessing",
    questions: [
      {
        questionText: "Which SQL clause is used to filter aggregated group records created by GROUP BY?",
        options: ["HAVING", "WHERE", "ORDER BY", "QUALIFY"],
        correctAnswer: "HAVING",
        points: 2,
        category: "SQL",
      },
      {
        questionText: "In Supervised Machine Learning, what is Overfitting?",
        options: ["Model fits training data extremely well but generalizes poorly to unseen data", "Model performs poorly on both training and test data", "Model trains in zero iterations", "Model only accepts categorical inputs"],
        correctAnswer: "Model fits training data extremely well but generalizes poorly to unseen data",
        points: 2,
        category: "Machine Learning",
      },
      {
        questionText: "Which Python pandas method calculates descriptive statistical summaries of numerical columns?",
        options: ["describe()", "info()", "summary()", "stats()"],
        correctAnswer: "describe()",
        points: 2,
        category: "Python Pandas",
      },
      {
        questionText: "What is the median of the dataset [3, 7, 8, 12, 15]?",
        options: ["8", "9", "7", "12"],
        correctAnswer: "8",
        points: 2,
        category: "Statistics",
      },
      {
        questionText: "Which metric is commonly used to evaluate classification models on imbalanced datasets?",
        options: ["F1-Score / ROC-AUC", "Mean Squared Error (MSE)", "R-Squared", "Mean Absolute Error"],
        correctAnswer: "F1-Score / ROC-AUC",
        points: 2,
        category: "Machine Learning",
      },
      {
        questionText: "What is the result of an INNER JOIN between two tables?",
        options: ["Returns only matching records present in both tables", "Returns all records from left table and matched from right", "Returns all records from right table only", "Returns Cartesian product of all rows"],
        correctAnswer: "Returns only matching records present in both tables",
        points: 2,
        category: "SQL",
      },
      {
        questionText: "What is the purpose of One-Hot Encoding in data preparation?",
        options: ["Convert categorical variables into binary matrix vectors", "Scale continuous numerical features to range 0-1", "Impute missing null values", "Reduce feature dimensions via PCA"],
        correctAnswer: "Convert categorical variables into binary matrix vectors",
        points: 2,
        category: "Data Preprocessing",
      },
      {
        questionText: "In A/B testing, what does a p-value less than 0.05 typically indicate?",
        options: ["Statistically significant difference rejecting null hypothesis", "Null hypothesis is guaranteed to be true", "Sample size was too small", "Test ran for zero days"],
        correctAnswer: "Statistically significant difference rejecting null hypothesis",
        points: 2,
        category: "A/B Testing",
      },
    ],
  },
  marketing_growth: {
    label: "Digital Marketing & Growth (8 Questions)",
    description: "SEO, Performance Marketing, CTR, CAC/LTV & Conversion Rate Optimization",
    questions: [
      {
        questionText: "What does CAC stand for in growth marketing analytics?",
        options: ["Customer Acquisition Cost", "Click Allocation Conversion", "Customer Action Count", "Content Advertising Campaign"],
        correctAnswer: "Customer Acquisition Cost",
        points: 2,
        category: "Growth Analytics",
      },
      {
        questionText: "Which metric measures the percentage of visitors who leave a webpage without taking any further action?",
        options: ["Bounce Rate", "Click-Through Rate", "Churn Rate", "Conversion Rate"],
        correctAnswer: "Bounce Rate",
        points: 2,
        category: "Web Analytics",
      },
      {
        questionText: "In Search Engine Optimization (SEO), what is the main purpose of alt text on HTML images?",
        options: ["Describe image content for accessibility and search engine indexing", "Encrypt image file size", "Trigger CSS hover animations", "Track user cursor clicks"],
        correctAnswer: "Describe image content for accessibility and search engine indexing",
        points: 2,
        category: "SEO",
      },
      {
        questionText: "If an ad campaign receives 1,000 impressions and 50 clicks, what is the Click-Through Rate (CTR)?",
        options: ["5.0%", "0.5%", "50%", "2.0%"],
        correctAnswer: "5.0%",
        points: 2,
        category: "Performance Marketing",
      },
      {
        questionText: "What is the ideal target ratio for Customer Lifetime Value (LTV) to Customer Acquisition Cost (CAC)?",
        options: ["3:1 or higher", "1:1", "1:3", "0.5:1"],
        correctAnswer: "3:1 or higher",
        points: 2,
        category: "Growth Metrics",
      },
      {
        questionText: "Which marketing channel relies primarily on organic search visibility rather than paid ad placements?",
        options: ["SEO (Search Engine Optimization)", "PPC (Pay-Per-Click)", "Display Ad Retargeting", "Paid Social Ads"],
        correctAnswer: "SEO (Search Engine Optimization)",
        points: 2,
        category: "SEO",
      },
      {
        questionText: "What is A/B testing in conversion rate optimization (CRO)?",
        options: ["Comparing two versions of a webpage or email to see which performs better", "Testing page load speeds on two different servers", "Running ads on Facebook vs LinkedIn", "Auditing accounting spreadsheets"],
        correctAnswer: "Comparing two versions of a webpage or email to see which performs better",
        points: 2,
        category: "CRO",
      },
      {
        questionText: "Which KPI measures customer retention over time?",
        options: ["Retention Rate / Churn Rate", "Click-Through Rate", "Cost Per Mille (CPM)", "Return On Ad Spend (ROAS)"],
        correctAnswer: "Retention Rate / Churn Rate",
        points: 2,
        category: "Growth Analytics",
      },
    ],
  },
  hr_talent: {
    label: "HR & Talent Acquisition (8 Questions)",
    description: "Sourcing, Behavioral Interviewing, Offer Negotiations, Onboarding & Compliance",
    questions: [
      {
        questionText: "What does the STAR methodology stand for in structured behavioral interview evaluation?",
        options: ["Situation, Task, Action, Result", "Skills, Talent, Attitude, Reaction", "Strategy, Timeline, Assessment, Review", "Sourcing, Tracking, Approval, Rejection"],
        correctAnswer: "Situation, Task, Action, Result",
        points: 2,
        category: "Interviewing",
      },
      {
        questionText: "Which metric tracks the average time elapsed between posting a job opening and candidate offer acceptance?",
        options: ["Time to Hire / Time to Fill", "Cost Per Click", "Employee Turnover Rate", "Offer Acceptance Percentage"],
        correctAnswer: "Time to Hire / Time to Fill",
        points: 2,
        category: "HR Analytics",
      },
      {
        questionText: "What is the primary objective of an Employee Onboarding program?",
        options: ["Integrate new hires effectively with tools, culture, and role expectations", "Conduct annual tax audits", "Filter out candidates before application", "Automate payroll distribution"],
        correctAnswer: "Integrate new hires effectively with tools, culture, and role expectations",
        points: 2,
        category: "Onboarding",
      },
      {
        questionText: "What is Employer Branding in talent acquisition?",
        options: ["The company's reputation and value proposition as an employer of choice", "Printing physical logos on office stationery", "Filing corporate tax documents", "Running product sales ads"],
        correctAnswer: "The company's reputation and value proposition as an employer of choice",
        points: 2,
        category: "Talent Acquisition",
      },
      {
        questionText: "Which practice helps reduce unconscious bias during resume screening?",
        options: ["Anonymized screening masking names, photos, and personal demographics", "Screening candidates based on social media profile photos", "Preferring candidates from a single local neighborhood", "Skipping candidate work experience reviews"],
        correctAnswer: "Anonymized screening masking names, photos, and personal demographics",
        points: 2,
        category: "DEI & Screening",
      },
      {
        questionText: "What is Employee Net Promoter Score (eNPS) used to measure?",
        options: ["Employee engagement and organizational loyalty", "Individual daily coding output", "Monthly office electricity usage", "Candidate resume page count"],
        correctAnswer: "Employee Net Promoter Score (eNPS) used to measure",
        points: 2,
        category: "HR Analytics",
      },
      {
        questionText: "Which document outlines official terms of employment, compensation, start date, and job duties?",
        options: ["Job Offer Letter / Employment Contract", "Non-Disclosure Agreement (NDA) only", "Project Status Report", "Marketing Brochure"],
        correctAnswer: "Job Offer Letter / Employment Contract",
        points: 2,
        category: "Compliance",
      },
      {
        questionText: "What is the main purpose of 360-Degree Feedback in performance management?",
        options: ["Gather feedback from peers, managers, direct reports, and self-evaluation", "Evaluate only the top senior executive", "Conduct financial budget reviews", "Monitor employee internet browser history"],
        correctAnswer: "Gather feedback from peers, managers, direct reports, and self-evaluation",
        points: 2,
        category: "Performance Management",
      },
    ],
  },
  finance_accounting: {
    label: "Finance & Accounting (8 Questions)",
    description: "Financial Statements, Balance Sheet, Budgeting, Cash Flow & Financial Ratios",
    questions: [
      {
        questionText: "Which accounting statement summarizes a company's assets, liabilities, and equity at a specific point in time?",
        options: ["Balance Sheet", "Income Statement", "Cash Flow Statement", "Statement of Retained Earnings"],
        correctAnswer: "Balance Sheet",
        points: 2,
        category: "Accounting",
      },
      {
        questionText: "What is the fundamental accounting equation?",
        options: ["Assets = Liabilities + Owner's Equity", "Assets = Revenue - Expenses", "Liabilities = Assets + Equity", "Equity = Assets + Liabilities"],
        correctAnswer: "Assets = Liabilities + Owner's Equity",
        points: 2,
        category: "Accounting",
      },
      {
        questionText: "What does EBITDA measure in financial analysis?",
        options: ["Earnings Before Interest, Taxes, Depreciation, and Amortization", "Equity Before Investment, Tax, and Dividend Allocation", "Estimated Balance In Total Debt Assets", "Effective Budget In Tax and Expense Accounts"],
        correctAnswer: "Earnings Before Interest, Taxes, Depreciation, and Amortization",
        points: 2,
        category: "Financial Analysis",
      },
      {
        questionText: "Which liquidity ratio measures a firm's ability to cover short-term obligations with current assets?",
        options: ["Current Ratio", "Debt-to-Equity Ratio", "Return on Equity (ROE)", "Gross Profit Margin"],
        correctAnswer: "Current Ratio",
        points: 2,
        category: "Financial Ratios",
      },
      {
        questionText: "What is Depreciation in corporate accounting?",
        options: ["Systematic allocation of the cost of a tangible asset over its useful life", "An immediate drop in stock market price", "Paying off long-term bank loan principal", "Increasing inventory market valuation"],
        correctAnswer: "Systematic allocation of the cost of a tangible asset over its useful life",
        points: 2,
        category: "Accounting",
      },
      {
        questionText: "In financial forecasting, what is Net Present Value (NPV)?",
        options: ["Difference between present value of cash inflows and outflows over time", "Total sum of historical cash balances", "Annual inflation rate percentage", "Total gross revenue minus payroll tax"],
        correctAnswer: "Difference between present value of cash inflows and outflows over time",
        points: 2,
        category: "Corporate Finance",
      },
      {
        questionText: "Which cash flow activity section includes cash received from issuing stock or paying dividends?",
        options: ["Financing Activities", "Operating Activities", "Investing Activities", "Non-Cash Adjustments"],
        correctAnswer: "Financing Activities",
        points: 2,
        category: "Cash Flow",
      },
      {
        questionText: "What is Working Capital?",
        options: ["Current Assets minus Current Liabilities", "Total Fixed Assets minus Depreciation", "Gross Revenue minus Operating Costs", "Owner's Equity minus Net Debt"],
        correctAnswer: "Current Assets minus Current Liabilities",
        points: 2,
        category: "Corporate Finance",
      },
    ],
  },
  operations_management: {
    label: "Operations & Business Management (8 Questions)",
    description: "Process Optimization, Supply Chain, SLA Management & Risk Analysis",
    questions: [
      {
        questionText: "What is the primary objective of Lean Management in operational processes?",
        options: ["Eliminate waste and maximize customer value through continuous improvement", "Increase inventory storage capacity", "Hire additional administrative staff", "Discontinue automated customer support"],
        correctAnswer: "Eliminate waste and maximize customer value through continuous improvement",
        points: 2,
        category: "Operations",
      },
      {
        questionText: "What does SLA stand for in operations and service management?",
        options: ["Service Level Agreement", "System Logistics Allocation", "Standard Logistics Audit", "Strategic Lead Assessment"],
        correctAnswer: "Service Level Agreement",
        points: 2,
        category: "Service Management",
      },
      {
        questionText: "Which methodology uses DMAIC (Define, Measure, Analyze, Improve, Control) to reduce process defects?",
        options: ["Six Sigma", "Agile Scrum", "Waterfall", "Balanced Scorecard"],
        correctAnswer: "Six Sigma",
        points: 2,
        category: "Process Improvement",
      },
      {
        questionText: "What is Just-In-Time (JIT) Inventory Management?",
        options: ["Receiving goods only as needed in the production process to minimize holding costs", "Stockpiling 5 years of excess inventory in warehouses", "Ordering supplies on random unscheduled dates", "Canceling supplier contracts"],
        correctAnswer: "Receiving goods only as needed in the production process to minimize holding costs",
        points: 2,
        category: "Supply Chain",
      },
      {
        questionText: "In project management, what is the Critical Path?",
        options: ["The longest sequence of dependent activities determining the minimum project duration", "The quickest path to complete non-essential tasks", "The budget expense breakdown", "The list of external suppliers"],
        correctAnswer: "The longest sequence of dependent activities determining the minimum project duration",
        points: 2,
        category: "Project Management",
      },
      {
        questionText: "What is a Bottleneck in an operational workflow?",
        options: ["A point of congestion that reduces the capacity of the entire pipeline", "A fast automated script", "A excess surge of raw materials", "A high-profit product line"],
        correctAnswer: "A point of congestion that reduces the capacity of the entire pipeline",
        points: 2,
        category: "Operations",
      },
      {
        questionText: "Which tool visualizes project schedules using horizontal timeline bar charts?",
        options: ["Gantt Chart", "Pareto Chart", "Fishbone Diagram", "Scatter Plot"],
        correctAnswer: "Gantt Chart",
        points: 2,
        category: "Project Management",
      },
      {
        questionText: "What does KPI stand for in organizational performance monitoring?",
        options: ["Key Performance Indicator", "Key Process Integration", "Knowledge Production Index", "Known Performance Inspection"],
        correctAnswer: "Key Performance Indicator",
        points: 2,
        category: "Management",
      },
    ],
  },
};

  // MCQ scheduling state
  const [mcqModalOpen, setMcqModalOpen] = React.useState(false);
  const [mcqScheduleTime, setMcqScheduleTime] = React.useState("");
  const [mcqPdfFile, setMcqPdfFile] = React.useState<File | null>(null);
  const [mcqJsonFile, setMcqJsonFile] = React.useState<File | null>(null);
  const [mcqParsedQuestions, setMcqParsedQuestions] = React.useState<any[] | null>(null);
  const [mcqValidationError, setMcqValidationError] = React.useState<string | null>(null);
  const [selectedPresetDomain, setSelectedPresetDomain] = React.useState<string>("software_tech");
  const [mcqSubmitting, setMcqSubmitting] = React.useState(false);

  // Coding scheduling state
  const [codingModalOpen, setCodingModalOpen] = React.useState(false);
  const [codingScheduleTime, setCodingScheduleTime] = React.useState("");
  const [codingDurationMinutes, setCodingDurationMinutes] = React.useState<number>(60);
  const [codingJsonFile, setCodingJsonFile] = React.useState<File | null>(null);
  const [codingParsedQuestions, setCodingParsedQuestions] = React.useState<any[] | null>(null);
  const [codingValidationError, setCodingValidationError] = React.useState<string | null>(null);
  const [codingSubmitting, setCodingSubmitting] = React.useState(false);

  // Interview scheduling state (AI Interview)
  const [interviewModalOpen, setInterviewModalOpen] = React.useState(false);
  const [interviewCard, setInterviewCard] = React.useState<CandidateAppCard | null>(null);
  const [interviewDateTime, setInterviewDateTime] = React.useState("");
  const [interviewDuration, setInterviewDuration] = React.useState("60");
  const [interviewNotes, setInterviewNotes] = React.useState("");
  const [interviewSubmitting, setInterviewSubmitting] = React.useState(false);



  const isPastDateSelected = React.useMemo(() => {
    if (!interviewDateTime) return false;
    const t = new Date(interviewDateTime).getTime();
    return !isNaN(t) && t < Date.now() - 5 * 60 * 1000;
  }, [interviewDateTime]);

  // Two-Level View State (summary vs board) & Top N submitting state
  const [viewMode, setViewMode] = React.useState<"summary" | "board">("summary");
  const [advancingTopN, setAdvancingTopN] = React.useState(false);

  const isTechJob = isTechDomain(activeJobDetails?.category, activeJobDetails?.title);
  const activeColumns = React.useMemo(() => (isTechJob ? techColumns : nonTechColumns), [isTechJob]);

  // Offer Letter Generation State
  const [offerModalCard, setOfferModalCard] = React.useState<CandidateAppCard | null>(null);
  const [scheduleFinalInterviewCard, setScheduleFinalInterviewCard] = React.useState<CandidateAppCard | null>(null);
  const [fullScreenModalCard, setFullScreenModalCard] = React.useState<CandidateApplicationModalData | null>(null);
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

          const rawCandName = cand ? `${cand.first_name || ""} ${cand.last_name || ""}`.trim() : "";
          const finalCandName = rawCandName || (cand?.email ? cand.email.split("@")[0] : "Candidate");
          const finalJobTitle = job?.title || activeJobDetails?.title || "Full Stack Web Developer";

          return {
            id: app.id,
            candidate_id: app.candidate_id,
            candidate_name: finalCandName,
            candidate_email: cand?.email || "",
            headline: cand?.headline || `${finalJobTitle} Applicant`,
            job_title: finalJobTitle,
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
        let userCompanyId: string | null = null;
        let userRecruiterId: string | null = null;

        if (user) {
          const { data: recruiter } = await supabase
            .schema("organization")
            .from("recruiters")
            .select("id, company_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (recruiter) {
            userRecruiterId = recruiter.id;
            if (recruiter.company_id) {
              userCompanyId = recruiter.company_id;
            }
          }
        }

        if (!userCompanyId && !userRecruiterId) {
          setJobs([]);
          setSelectedJobId("");
          return;
        }

        let query = supabase
          .schema("job")
          .from("jobs")
          .select("id, title, created_at, company_id")
          .is("deleted_at", null);

        if (userCompanyId) {
          query = query.eq("company_id", userCompanyId);
        } else if (userRecruiterId) {
          query = query.eq("recruiter_id", userRecruiterId);
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
    if (s === "zoom_interview" || s === "recruiter_review" || s === "interview_scheduled" || s === "final_interview" || s === "hiring_decision") return "zoom_interview";
    if (s === "offer_sent" || s === "offered" || s === "offer" || s === "offer_accepted") return "offer_sent";
    if (s === "hired" || s === "joined") return "hired";
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
    if (advancingTopN) return;
    if (!count || isNaN(count) || count <= 0) {
      alert("Please enter a valid candidate count (N > 0).");
      return;
    }

    const isTechJob = isTechDomain(activeJobDetails?.category, activeJobDetails?.title);
    const activeCols = isTechJob ? techColumns : nonTechColumns;
    const activeKeys = activeCols.map((c) => c.key);
    const currentIdx = activeKeys.indexOf(fromStage);
    if (currentIdx === -1 || currentIdx >= activeKeys.length - 1) return;

    const toStage = activeKeys[currentIdx + 1];
    const fromStageName = activeCols[currentIdx].name;
    const toStageName = activeCols[currentIdx + 1].name;

    // Filter candidates currently in this stage (excluding rejected/withdrawn)
    let stageCards = cards.filter((c) => c.status === fromStage);
    if (stageCards.length === 0) {
      alert(`No candidates currently in ${fromStageName} stage.`);
      return;
    }

    // Deterministic Sorting: Primary score descending + Secondary tie-breaker (created_at ascending)
    stageCards.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (fromStage === "screening") {
        scoreA = a.screening_score != null ? a.screening_score : (a.score ? a.score * 10 : 0);
        scoreB = b.screening_score != null ? b.screening_score : (b.score ? b.score * 10 : 0);
      } else if (fromStage === "mcq") {
        scoreA = a.mcq_score || 0;
        scoreB = b.mcq_score || 0;
      } else if (fromStage === "coding") {
        scoreA = a.coding_score || 0;
        scoreB = b.coding_score || 0;
      } else if (fromStage === "interview") {
        scoreA = a.interview_avg_score || 0;
        scoreB = b.interview_avg_score || 0;
      } else {
        scoreA = a.score || 0;
        scoreB = b.score || 0;
      }

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      // Secondary deterministic tie-breaker: created_at timestamp
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const numToAdvance = Math.min(count, stageCards.length);
    const targetCards = stageCards.slice(0, numToAdvance);

    setAdvancingTopN(true);
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
      if (failed) throw new Error("Database update failed for one or more candidates.");

      logger.info(`[PipelinePage] Objective Top N advanced ${targetCards.length} candidates from ${fromStage} to ${toStage}`);
      alert(`🎉 Successfully advanced Top ${targetCards.length} candidates from ${fromStageName} to ${toStageName}!`);
      await fetchPipelineData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Top N advancement failed, rolling back UI", err);
      alert(`Advancement Error: ${msg}. Rolling back changes.`);
      setCards(previousCards);
    } finally {
      setAdvancingTopN(false);
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

    if (!mcqParsedQuestions || mcqParsedQuestions.length === 0) {
      alert("Please upload a valid MCQ questions JSON file before scheduling.");
      return;
    }

    setMcqSubmitting(true);
    try {
      const questionsToSend = mcqParsedQuestions;

      const res = await fetch(`/api/recruiter/jobs/${selectedJobId}/schedule-mcq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledTime: new Date(mcqScheduleTime).toISOString(),
          jsonQuestions: questionsToSend,
          durationMinutes: Math.max(10, questionsToSend.length),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || "Failed to save MCQ schedule");
      }

      setMcqModalOpen(false);
      setMcqJsonFile(null);
      setMcqParsedQuestions(null);
      setMcqValidationError(null);
      await fetchPipelineData();
    } catch (err: unknown) {
      logger.error("Failed to save MCQ exam schedule", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Scheduling Error: ${msg}`);
    } finally {
      setMcqSubmitting(false);
    }
  };

  const handleCodingJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCodingJsonFile(file);
    setCodingValidationError(null);
    setCodingParsedQuestions(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const list = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.problems || [parsed]);

        if (!Array.isArray(list) || list.length === 0) {
          setCodingValidationError("Invalid JSON: Expected an array of coding problems.");
          return;
        }

        for (let i = 0; i < list.length; i++) {
          const q = list[i];
          const num = i + 1;
          const title = (q.title || q.name || "").toString().trim();
          const desc = (q.description || q.question_text || q.problem || "").toString().trim();

          if (!title && !desc) {
            setCodingValidationError(`Coding Problem ${num} is missing a valid title or description.`);
            return;
          }

          const tcs = q.testCases || q.examples;
          if (!Array.isArray(tcs) || tcs.length === 0) {
            setCodingValidationError(`Coding Problem ${num} ("${title || "Untitled"}") is missing test cases.`);
            return;
          }
        }

        setCodingParsedQuestions(list);
        setCodingValidationError(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Syntax error parsing JSON file.";
        setCodingValidationError(`Invalid JSON Format: ${msg}`);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveCodingSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !codingScheduleTime) return;

    if (!codingParsedQuestions || codingParsedQuestions.length === 0) {
      alert("Please upload a valid coding questions JSON file containing coding problems and test cases.");
      return;
    }

    setCodingSubmitting(true);
    try {
      const res = await fetch(`/api/recruiter/jobs/${selectedJobId}/schedule-coding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledTime: new Date(codingScheduleTime).toISOString(),
          durationMinutes: codingDurationMinutes,
          jsonQuestions: codingParsedQuestions,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || resData.message || "Failed to save Coding round schedule");
      }

      alert(`✓ Coding Assessment successfully scheduled! ${resData.questionsCount || codingParsedQuestions.length} coding problems assigned.`);
      setCodingModalOpen(false);
      setCodingJsonFile(null);
      setCodingParsedQuestions(null);
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
    if (!selectedJobId) {
      alert("Please select a job posting to schedule the interview.");
      return;
    }
    if (!interviewDateTime) {
      alert("Please select an interview start date and time.");
      return;
    }
    setInterviewSubmitting(true);
    try {
      const parsedDate = new Date(interviewDateTime);
      const isoDate = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

      // Call dedicated AI Interview Scheduler API
      const res = await fetch(`/api/recruiter/jobs/${selectedJobId}/schedule-ai-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationIds: interviewCard ? [interviewCard.id] : undefined,
          scheduledStartAt: isoDate,
          durationMinutes: Number(interviewDuration) || 60,
          focusTopics: interviewNotes || undefined,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || resData.message || "Failed to schedule AI Interview");
      }

      setInterviewModalOpen(false);
      setInterviewCard(null);
      setInterviewDateTime("");
      setInterviewNotes("");

      await fetchPipelineData();

      alert(`AI Interview scheduled successfully.`);
      logger.info(`[PipelinePage] AI Interview scheduled for job: ${selectedJobId}`);
    } catch (err: unknown) {
      logger.error("Failed to save AI interview schedule", err);
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

      {/* Recruiter Job Management Operations Bar */}
      {selectedJobId && activeJobDetails && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-xs gap-3 flex-wrap text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-zinc-900">{activeJobDetails.title}</h2>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  activeJobDetails.status === "closed" ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                }`}>
                  {activeJobDetails.status || "published"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                {activeJobDetails.category || "Technology"} • {activeJobDetails.location || "Remote"} • {cards.length} Total Applicants
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit Job Button */}
            <Link
              href={`/recruiter/jobs/${selectedJobId}/edit`}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5 text-blue-400" />
              <span>Edit Job</span>
            </Link>

            {/* Close / Reopen Job Button */}
            <button
              type="button"
              onClick={async () => {
                const newStatus = activeJobDetails.status === "closed" ? "published" : "closed";
                try {
                  await supabase.schema("job").from("jobs").update({ status: newStatus }).eq("id", selectedJobId);
                  setActiveJobDetails((prev) => prev ? { ...prev, status: newStatus } : null);
                  fetchPipelineData();
                } catch (err) {
                  logger.error("Failed to toggle job status", err);
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                activeJobDetails.status === "closed"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                  : "bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
              }`}
            >
              {activeJobDetails.status === "closed" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Re-Open Job</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Close Job</span>
                </>
              )}
            </button>

            {/* View Job Overview */}
            <Link
              href={`/recruiter/jobs/${selectedJobId}`}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center gap-1 border border-blue-200 transition-colors cursor-pointer"
            >
              <span>Overview Details →</span>
            </Link>
          </div>
        </div>
      )}
      {/* Two-Level View Switcher Toolbar */}
      <div className="flex items-center justify-between py-2 border-b border-zinc-200 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            {viewMode === "summary" ? "Pipeline Overview" : "Full Hiring Pipeline"}
          </span>
          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
            {activeJobDetails?.title || "Active Job"}
          </span>
        </div>
        <button
          onClick={() => setViewMode(viewMode === "summary" ? "board" : "summary")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          {viewMode === "summary" ? (
            <>
              <span>Open Full Kanban Board</span>
              <ChevronRight className="h-4 w-4 text-blue-400" />
            </>
          ) : (
            <>
              <span>Back to Funnel Summary</span>
              <BarChart3 className="h-4 w-4 text-emerald-400" />
            </>
          )}
        </button>
      </div>

      {/* LEVEL 1: RECRUITMENT FUNNEL OVERVIEW SUMMARY CARDS */}
      {viewMode === "summary" && (
        <div className="space-y-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeColumns.map((col) => {
              const colCards = cards.filter((c) => {
                if (c.status === "rejected" || c.status === "withdrawn") {
                  return false; // Handled separately for Rejected card if needed or included per stage
                }
                if (col.key === "interview") return ["interview", "ai_interview"].includes(c.status);
                if (col.key === "zoom_interview") return ["zoom_interview", "recruiter_review", "interview_scheduled", "final_interview"].includes(c.status);
                if (col.key === "offer_sent") return ["offer_sent", "offer_accepted", "joined", "offered"].includes(c.status);
                return c.status === col.key;
              });

              const rejectedCards = cards.filter((c) => c.status === "rejected" || c.status === "withdrawn");
              const totalCandidates = colCards.length;

              // 0. Applied Card Metrics
              if (col.key === "applied") {
                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/applications`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-blue-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-blue-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Initial Submissions:</span><span className="font-bold text-zinc-900">{totalCandidates}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Pipeline Status:</span><span className="font-bold text-emerald-600">Active</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-blue-600">
                      <span>View Applications →</span>
                    </div>
                  </div>
                );
              }

              // 1. ATS Screening Card Metrics
              if (col.key === "screening") {
                const screened = colCards.filter((c) => c.screening_score != null || c.score != null).length;
                const qualified = colCards.filter((c) => (c.screening_score != null && c.screening_score >= 60) || (c.score != null && c.score >= 6)).length;
                const pending = Math.max(0, totalCandidates - screened);

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/ats`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-[#0071E3] transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-blue-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Screened:</span><span className="font-bold text-zinc-900">{screened}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Qualified:</span><span className="font-bold text-emerald-600">{qualified}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Pending:</span><span className="font-bold text-amber-600">{pending}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-blue-600">
                      <span>Open ATS Details →</span>
                    </div>
                  </div>
                );
              }

              // 2. MCQ Assessment Card Metrics
              if (col.key === "mcq") {
                const completed = colCards.filter((c) => c.mcq_score != null).length;
                const pending = Math.max(0, totalCandidates - completed);
                const scores = colCards.map((c) => c.mcq_score).filter((s): s is number => s != null);
                const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/mcq`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-blue-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-blue-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Completed:</span><span className="font-bold text-zinc-900">{completed}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Pending:</span><span className="font-bold text-amber-600">{pending}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Average Score:</span><span className="font-bold text-emerald-600">{avgScore != null ? `${avgScore}%` : "—"}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-blue-600">
                      <span>Open MCQ Details →</span>
                    </div>
                  </div>
                );
              }

              // 3. Coding Assessment Card Metrics
              if (col.key === "coding") {
                const completed = colCards.filter((c) => c.coding_score != null).length;
                const pending = Math.max(0, totalCandidates - completed);
                const scores = colCards.map((c) => c.coding_score).filter((s): s is number => s != null);
                const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/coding`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-emerald-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-emerald-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Completed:</span><span className="font-bold text-zinc-900">{completed}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Pending:</span><span className="font-bold text-amber-600">{pending}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Average Score:</span><span className="font-bold text-emerald-600">{avgScore != null ? `${avgScore}%` : "—"}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-emerald-600">
                      <span>Open Coding Details →</span>
                    </div>
                  </div>
                );
              }

              // 4. AI Interview Card Metrics
              if (col.key === "interview") {
                const scheduled = colCards.filter((c) => c.interview_scheduled_at != null).length;
                const completed = colCards.filter((c) => c.interview_avg_score != null || c.interview_recommendation != null).length;
                const pending = Math.max(0, totalCandidates - completed);

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/ai-interview`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-violet-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-violet-600 transition-colors flex items-center gap-1.5">
                          <span>{col.name}</span>
                          {hasUnreadForContext({ jobId: selectedJobId, roundKey: col.key }) && <UnreadDot size="sm" />}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-bold border border-violet-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Scheduled:</span><span className="font-bold text-blue-600">{scheduled}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Completed:</span><span className="font-bold text-zinc-900">{completed}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Pending:</span><span className="font-bold text-amber-600">{pending}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-end text-[10px] font-bold text-violet-600">
                      <span>Open AI Interview Details →</span>
                    </div>
                  </div>
                );
              }

              // 5. Recruiter Final Interview Card Metrics
              if (col.key === "zoom_interview") {
                const scheduled = colCards.filter((c) => c.interview_scheduled_at != null).length;
                const completed = colCards.filter((c) => c.interview_avg_score != null || c.interview_recommendation != null).length;
                const pending = Math.max(0, totalCandidates - completed);

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/final-interview`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-violet-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Scheduled:</span><span className="font-bold text-blue-600">{scheduled}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Completed:</span><span className="font-bold text-zinc-900">{completed}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Pending:</span><span className="font-bold text-amber-600">{pending}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-indigo-600">
                      <span>Open Final Interview Details →</span>
                    </div>
                  </div>
                );
              }

              // 6. Hiring Decision Card Metrics
              if (col.key === "hiring_decision") {
                const awaitingDecision = colCards.filter((c) => !["approved_for_offer", "on_hold", "rejected"].includes(c.decision_status || "")).length;
                const approved = colCards.filter((c) => c.decision_status === "approved_for_offer").length;
                const onHold = colCards.filter((c) => c.decision_status === "on_hold").length;

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/hiring-decision`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-violet-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-violet-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-bold border border-violet-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Awaiting Decision:</span><span className="font-bold text-amber-600">{awaitingDecision}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Approved for Offer:</span><span className="font-bold text-emerald-600">{approved}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">On Hold:</span><span className="font-bold text-violet-600">{onHold}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-violet-600">
                      <span>Open Decisions →</span>
                    </div>
                  </div>
                );
              }

              // 7. Offer Card Metrics
              if (col.key === "offer_sent") {
                const offersGenerated = colCards.length;
                const offersAccepted = colCards.filter((c) => c.status === "offer_accepted" || c.status === "joined").length;
                const offersSent = colCards.filter((c) => c.status === "offer_sent" || c.status === "offered").length;

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/offers`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-emerald-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-emerald-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Offers Sent:</span><span className="font-bold text-blue-600">{offersSent}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Accepted:</span><span className="font-bold text-emerald-600">{offersAccepted}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Total Offers:</span><span className="font-bold text-zinc-900">{offersGenerated}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-emerald-600">
                      <span>Open Offers →</span>
                    </div>
                  </div>
                );
              }

              // 8. Hired / Joined Card Metrics
              if (col.key === "hired") {
                const joinedCount = colCards.filter((c) => c.status === "joined" || c.joining_status === "joined").length;
                const pendingJoin = colCards.filter((c) => c.status === "hired" && c.joining_status !== "joined").length;

                return (
                  <div
                    key={col.key}
                    onClick={() => router.push(`/recruiter/jobs/${selectedJobId}/offers`)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md hover:border-teal-600 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                        <h3 className="text-xs font-extrabold text-zinc-900 group-hover:text-teal-600 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold border border-teal-100">
                        {totalCandidates} Candidates
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Joined:</span><span className="font-bold text-teal-600">{joinedCount}</span></div>
                      <div className="flex justify-between"><span className="font-medium text-zinc-500">Joining Pending:</span><span className="font-bold text-amber-600">{pendingJoin}</span></div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-teal-600">
                      <span>View Hired Candidates →</span>
                    </div>
                  </div>
                );
              }

              // Default fallback card
              return (
                <div
                  key={col.key}
                  onClick={() => setViewMode("board")}
                  className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#D2D2D7] shadow-xs hover:shadow-md transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                    <h3 className="text-xs font-extrabold text-zinc-900">{col.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800 text-[11px] font-bold">
                      {totalCandidates} Candidates
                    </span>
                  </div>

                  <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-blue-600">
                    <span>View Board →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LEVEL 2: KANBAN BOARD CONTAINER (LOADING STATE) */}
      {viewMode === "board" && loading && (
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
      )}

      {/* LEVEL 2: KANBAN BOARD CONTAINER (LOADED STATE) */}
      {viewMode === "board" && !loading && (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 select-none no-scrollbar snap-x snap-mandatory">
          {activeColumns.map((col) => {
            let colCards = cards.filter((c) => {
              if (c.status === "rejected" || c.status === "withdrawn") {
                const rejStage = c.rejection_stage || "screening";
                return getCanonicalStageKey(rejStage) === col.key;
              }
              if (col.key === "interview") return ["interview", "ai_interview"].includes(c.status);
              if (col.key === "zoom_interview") return ["zoom_interview", "recruiter_review", "interview_scheduled", "final_interview"].includes(c.status);
              if (col.key === "hiring_decision") return c.status === "hiring_decision";
              if (col.key === "offer_sent") return ["offer_sent", "offer_accepted", "offered", "offer"].includes(c.status);
              if (col.key === "hired") return ["hired", "joined"].includes(c.status);
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
            } else {
              colCards = [...colCards].sort((a, b) => (b.score || 0) - (a.score || 0));
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

                {/* Applied stage controls - Only Advance All Applicants button, no Top-N dropdown */}
                {col.key === "applied" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Applications Control
                      </span>
                    </div>
                    <button
                      onClick={() => handleAdvanceAll("applied")}
                      disabled={colCards.length === 0}
                      className="w-full bg-[#0071E3] hover:bg-[#0051A3] disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" /> Advance All Applicants ({colCards.length})
                    </button>
                  </div>
                )}

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

                        <div className="pt-2 border-t border-zinc-100 space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-bold text-zinc-500">
                            <span>Top Candidates Advancement:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={stageTopNMap[col.key] ?? 5}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStageTopNMap((prev) => ({ ...prev, [col.key]: val }));
                              }}
                              className="h-7 text-[10px] font-bold rounded-lg border border-[#D2D2D7] bg-white px-2 py-0.5 outline-none select-none text-zinc-800 cursor-pointer"
                            >
                              {[1, 3, 5, 10, 15, 20, 25, 30, 50].map((num) => (
                                <option key={num} value={num}>
                                  Top {num}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAdvanceTopN(col.key, stageTopNMap[col.key] ?? 5)}
                              disabled={advancingTopN || colCards.length === 0}
                              className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-[10px] font-bold h-7 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              Advance Top {colCards.length > 0 ? Math.min(stageTopNMap[col.key] ?? 5, colCards.length) : (stageTopNMap[col.key] ?? 5)}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ Test scheduling & Top N controls */}
                {col.key === "mcq" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        EXAM SCHEDULER
                      </span>
                    </div>

                    {!selectedJobId ? (
                      <p className="text-[9px] text-[#AEAEB2] italic font-semibold">
                        Select a job posting
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        <button
                          onClick={() => {
                            setMcqScheduleTime(getDefaultDatetimeLocal());
                            setMcqModalOpen(true);
                          }}
                          className="w-full bg-[#0071E3] hover:bg-[#0051A3] text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        >
                          Schedule MCQ Exam
                        </button>

                        <div className="pt-2 border-t border-zinc-100 space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-bold text-zinc-500">
                            <span>Top Candidates Advancement:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={stageTopNMap[col.key] ?? 5}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStageTopNMap((prev) => ({ ...prev, [col.key]: val }));
                              }}
                              className="h-7 text-[10px] font-bold rounded-lg border border-[#D2D2D7] bg-white px-2 py-0.5 outline-none select-none text-zinc-800 cursor-pointer"
                            >
                              {[1, 3, 5, 10, 15, 20, 25, 30, 50].map((num) => (
                                <option key={num} value={num}>
                                  Top {num}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAdvanceTopN(col.key, stageTopNMap[col.key] ?? 5)}
                              disabled={advancingTopN || colCards.length === 0}
                              className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-[10px] font-bold h-7 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              Advance Top {colCards.length > 0 ? Math.min(stageTopNMap[col.key] ?? 5, colCards.length) : (stageTopNMap[col.key] ?? 5)}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Coding Round scheduling & Top N controls */}
                {col.key === "coding" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        IDE ASSESSMENT
                      </span>
                    </div>

                    {!selectedJobId ? (
                      <p className="text-[9px] text-[#AEAEB2] italic font-semibold">
                        Select a job posting
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        <button
                          onClick={() => {
                            setCodingScheduleTime(getDefaultDatetimeLocal());
                            setCodingModalOpen(true);
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        >
                          Schedule Coding Round
                        </button>

                        <div className="pt-2 border-t border-zinc-100 space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-bold text-zinc-500">
                            <span>Top Candidates Advancement:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={stageTopNMap[col.key] ?? 5}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStageTopNMap((prev) => ({ ...prev, [col.key]: val }));
                              }}
                              className="h-7 text-[10px] font-bold rounded-lg border border-[#D2D2D7] bg-white px-2 py-0.5 outline-none select-none text-zinc-800 cursor-pointer"
                            >
                              {[1, 3, 5, 10, 15, 20, 25, 30, 50].map((num) => (
                                <option key={num} value={num}>
                                  Top {num}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAdvanceTopN(col.key, stageTopNMap[col.key] ?? 5)}
                              disabled={advancingTopN || colCards.length === 0}
                              className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-[10px] font-bold h-7 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              Advance Top {colCards.length > 0 ? Math.min(stageTopNMap[col.key] ?? 5, colCards.length) : (stageTopNMap[col.key] ?? 5)}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Interview Room scheduling & Top N controls */}
                {col.key === "interview" && (
                  <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#D2D2D7] shadow-sm space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">AI Interview Room</span>
                      </div>
                      <span className="text-[10px] font-extrabold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100 tabular-nums">
                        {colCards.length} Active
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 py-1">
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
                        if (!selectedJobId) return;
                        setInterviewDateTime(getDefaultDatetimeLocal());
                        setInterviewDuration("60");
                        setInterviewNotes("");
                        setInterviewModalOpen(true);
                      }}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold h-7.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Calendar className="h-3.5 w-3.5" /> Schedule AI Interview for All Candidates
                    </button>

                    <div className="pt-2 border-t border-zinc-100 space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-bold text-zinc-500">
                        <span>Top Candidates Advancement:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={stageTopNMap[col.key] ?? 5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setStageTopNMap((prev) => ({ ...prev, [col.key]: val }));
                          }}
                          className="h-7 text-[10px] font-bold rounded-lg border border-[#D2D2D7] bg-white px-2 py-0.5 outline-none select-none text-zinc-800 cursor-pointer"
                        >
                          {[1, 3, 5, 10, 15, 20, 25, 30, 50].map((num) => (
                            <option key={num} value={num}>
                              Top {num}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAdvanceTopN(col.key, stageTopNMap[col.key] ?? 5)}
                          disabled={advancingTopN || colCards.length === 0}
                          className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-[10px] font-bold h-7 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          Advance Top {colCards.length > 0 ? Math.min(stageTopNMap[col.key] ?? 5, colCards.length) : (stageTopNMap[col.key] ?? 5)}
                        </button>
                      </div>
                    </div>
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
                        isUnread={hasUnreadForContext({ applicationId: card.id })}
                        onClick={(c) => {
                          markContextAsRead({ applicationId: c.id });
                          if (col.key === "interview") {
                            setInterviewCard(c);
                            setInterviewDateTime(c.interview_scheduled_at ? new Date(new Date(c.interview_scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : getDefaultDatetimeLocal());
                            setInterviewModalOpen(true);
                          } else {
                            setActiveCard(c);
                          }
                        }}
                        onAdvance={handleAdvanceSingleCandidate}
                        onReject={["offer_sent", "hired", "joined", "offered"].includes(col.key) || ["hired", "joined", "offer_accepted"].includes(card.status) ? undefined : (c) => handleRejectCandidate(c, col.key)}
                        onReinstate={(c) => handleReinstateCandidate(c, col.key)}
                        onFullScreen={(c) => {
                          markContextAsRead({ applicationId: c.id });
                          setFullScreenModalCard(c as any);
                        }}
                        onScheduleFinalInterview={(c) => {
                          markContextAsRead({ applicationId: c.id });
                          setScheduleFinalInterviewCard(c);
                        }}
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
    className="w-full max-w-lg bg-white border border-[#D2D2D7] rounded-[20px] shadow-2xl p-6 space-y-5 text-left scale-in-center max-h-[90vh] overflow-y-auto"
  >
    <div>
      <h3 className="text-base font-bold text-zinc-900">Schedule MCQ Screening Exam</h3>
      <p className="text-[11px] text-[#6E6E73] mt-1 font-medium leading-relaxed">
        Upload your job-specific MCQ questions JSON file and select the scheduled exam date/time.
      </p>
    </div>

    <div className="space-y-4 pt-1">
      {/* 1. MCQ JSON Upload Field */}
      <div className="space-y-2">
        <label className="text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider block">
          Upload MCQ Questions & Answers (.json) *
        </label>
        
        {/* Expected JSON Format Preview */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-left space-y-1">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Expected JSON Structure:</p>
          <code className="block text-[10px] font-mono text-blue-700 bg-white p-2 rounded-lg border border-zinc-200 overflow-x-auto leading-relaxed">
            {`[{"question":"...","options":["A","B","C","D"],"correctAnswer":"A"}]`}
          </code>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setMcqJsonFile(file);
              setMcqValidationError(null);
              setMcqParsedQuestions(null);

              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const content = event.target?.result as string;
                  const parsed = JSON.parse(content);
                  const questionsList = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.questions) ? parsed.questions : null);

                  if (!questionsList || questionsList.length === 0) {
                    setMcqValidationError("MCQ JSON file must contain a non-empty array of questions.");
                    return;
                  }

                  // Validate each question
                  for (let i = 0; i < questionsList.length; i++) {
                    const q = questionsList[i];
                    const num = i + 1;
                    const text = (q.questionText || q.question || q.title || "").toString().trim();
                    if (!text) {
                      setMcqValidationError(`Question ${num} does not contain valid question text.`);
                      return;
                    }
                    const opts = q.options;
                    if (!Array.isArray(opts) || opts.length < 2) {
                      setMcqValidationError(`Question ${num} must contain at least two options.`);
                      return;
                    }
                    // Ensure options contain no empty strings
                    for (let j = 0; j < opts.length; j++) {
                      const optStr = (typeof opts[j] === "object" && opts[j] !== null ? opts[j].text || opts[j].option : String(opts[j])).trim();
                      if (!optStr) {
                        setMcqValidationError(`Question ${num} option ${j + 1} cannot be empty.`);
                        return;
                      }
                    }
                    const correct = q.correctAnswer ?? q.correct_answer ?? q.answer;
                    if (correct === undefined || correct === null || correct === "") {
                      setMcqValidationError(`Question ${num} does not contain a valid correct answer.`);
                      return;
                    }
                  }

                  // All valid!
                  setMcqParsedQuestions(questionsList);
                  setMcqValidationError(null);
                } catch {
                  setMcqValidationError("Malformed JSON file. Please ensure it is valid JSON.");
                }
              };
              reader.readAsText(file);
            }}
            className="block w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />

          {mcqValidationError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold flex items-start gap-1.5">
              <span>⚠️ {mcqValidationError}</span>
            </div>
          )}

          {mcqParsedQuestions && !mcqValidationError && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>✓ {mcqParsedQuestions.length} valid questions loaded</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Exam Start Date & Time */}
      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider block">
          Exam Start Date & Time *
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
          setMcqJsonFile(null);
          setMcqParsedQuestions(null);
          setMcqValidationError(null);
        }}
        className="px-4 py-2 text-[12px] font-bold text-zinc-650 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={mcqSubmitting || !mcqScheduleTime || !mcqParsedQuestions || !!mcqValidationError}
        className="bg-[#0071E3] hover:bg-[#0051A3] text-white text-[12px] font-bold px-5 py-2 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {mcqSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scheduling...
          </>
        ) : (
          "Schedule MCQ Round"
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
        Set the coding round start time and upload your problem specification & test cases (.json file).
      </p>
    </div>

    <div className="space-y-4 pt-1">
      {/* Upload Coding JSON */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
          Upload Coding Questions Document (.json) *
        </label>

        <div className="relative border-2 border-dashed border-[#D2D2D7] hover:border-emerald-500 bg-[#F5F5F7] hover:bg-emerald-50/20 rounded-xl p-4 text-center transition-all cursor-pointer">
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleCodingJsonFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div className="flex flex-col items-center gap-1.5 pointer-events-none">
            <FileCode className="h-6 w-6 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-800">
              {codingJsonFile ? codingJsonFile.name : "Click or drag Coding JSON file here"}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">
              Upload custom coding problems & test specs (.json)
            </span>
          </div>
        </div>

        {codingValidationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
            {codingValidationError}
          </div>
        )}

        {codingParsedQuestions && codingParsedQuestions.length > 0 && !codingValidationError && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center justify-between">
            <span>✓ {codingParsedQuestions.length} valid coding problems loaded</span>
            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold">Ready</span>
          </div>
        )}
      </div>

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

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
          Coding Exam Duration (Minutes) *
        </label>
        <select
          value={codingDurationMinutes}
          onChange={(e) => setCodingDurationMinutes(Number(e.target.value))}
          className="w-full rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2.5 text-[13px] text-zinc-800 font-bold outline-none cursor-pointer focus:border-emerald-600"
        >
          <option value={30}>30 Minutes</option>
          <option value={45}>45 Minutes</option>
          <option value={60}>60 Minutes (Standard)</option>
          <option value={90}>90 Minutes</option>
          <option value={120}>120 Minutes</option>
        </select>
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
      <button
        type="button"
        onClick={() => {
          setCodingModalOpen(false);
          setCodingJsonFile(null);
          setCodingParsedQuestions(null);
          setCodingValidationError(null);
        }}
        className="px-4 py-2 text-[12px] font-bold text-zinc-650 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={codingSubmitting || !codingScheduleTime || !codingParsedQuestions || !!codingValidationError}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
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

{/* Schedule AI Interview Modal */}
{interviewModalOpen && (
  <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
    <form
      onSubmit={handleSaveInterviewSchedule}
      className="w-full max-w-lg bg-white border border-[#D2D2D7] rounded-[20px] shadow-2xl p-6 space-y-5 text-left scale-in-center max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900">Schedule AI Interview</h3>
          <p className="text-[11px] text-[#6E6E73] mt-1 font-medium leading-relaxed">
            Schedule a live AI interview powered by Gemini. Questions will adapt to the job requirements and candidate responses.
          </p>
          {interviewCard ? (
            <p className="text-[11px] font-bold text-violet-700 mt-1">
              Candidate: {interviewCard.candidate_name}
            </p>
          ) : (
            <p className="text-[11px] font-bold text-violet-700 mt-1">
              Scheduling AI Interview for all candidates in this job pipeline
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setInterviewModalOpen(false); setInterviewCard(null); }}
          className="text-zinc-400 hover:text-zinc-700 h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Date & Time Picker */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider block">
            Interview Date & Time *
          </label>
          <input
            type="datetime-local"
            value={interviewDateTime}
            onChange={(e) => setInterviewDateTime(e.target.value)}
            required
            className="w-full h-10 rounded-xl border border-[#D2D2D7] bg-white px-3.5 text-xs font-semibold text-zinc-900 outline-none focus:border-[#0071E3]"
          />
          {isPastDateSelected && (
            <p className="text-[11px] font-bold text-rose-600 mt-1">
              Please select a future interview date and time.
            </p>
          )}
        </div>

        {/* Duration Picker */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider block">
            Duration
          </label>
          <select
            value={interviewDuration}
            onChange={(e) => setInterviewDuration(e.target.value)}
            className="w-full h-10 rounded-xl border border-[#D2D2D7] bg-white px-3 text-xs font-bold text-zinc-900 outline-none focus:border-[#0071E3] cursor-pointer"
          >
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes (Default)</option>
            <option value="75">75 minutes</option>
            <option value="90">90 minutes</option>
          </select>
        </div>

        {/* Focus Topics / Instructions */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider block">
            Focus Topics / Instructions (Optional)
          </label>
          <textarea
            value={interviewNotes}
            onChange={(e) => setInterviewNotes(e.target.value)}
            placeholder="e.g. Focus on SQL, data analysis, problem solving and stakeholder communication."
            rows={3}
            className="w-full rounded-xl border border-[#D2D2D7] bg-white p-3 text-xs font-medium text-zinc-900 outline-none focus:border-[#0071E3] placeholder:text-zinc-400 resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-3 border-t border-zinc-100">
        <button
          type="button"
          onClick={() => { setInterviewModalOpen(false); setInterviewCard(null); }}
          className="flex-1 h-9 rounded-xl border border-[#D2D2D7] bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={interviewSubmitting || !interviewDateTime || isPastDateSelected}
          className="flex-1 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {interviewSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Schedule AI Interview"}
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
{fullScreenModalCard && (
  <FullScreenCandidateModal
    application={fullScreenModalCard}
    onClose={() => setFullScreenModalCard(null)}
    onStatusChange={(id, newStatus) => {
      const card = cards.find((c) => c.id === id);
      if (card) {
        if (newStatus === "rejected") handleRejectCandidate(card, card.status);
        else handleAdvanceSingleCandidate(card);
      }
      setFullScreenModalCard(null);
    }}
  />
)}

{scheduleFinalInterviewCard && (
  <ScheduleFinalInterviewModal
    isOpen={Boolean(scheduleFinalInterviewCard)}
    onClose={() => setScheduleFinalInterviewCard(null)}
    onSuccess={() => {
      setScheduleFinalInterviewCard(null);
      fetchJobPipeline();
    }}
    applicationId={scheduleFinalInterviewCard.id}
    candidateName={scheduleFinalInterviewCard.candidate_name}
    candidateEmail={scheduleFinalInterviewCard.candidate_email}
    jobTitle={scheduleFinalInterviewCard.job_title || activeJobDetails?.title}
  />
)}
</div>
);
}
