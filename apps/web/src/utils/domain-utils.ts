/**
 * Utility functions for domain classification across job postings & application pipelines.
 */

/**
 * Determines whether a job posting belongs to the "Tech" / "Software" domain.
 * Non-tech domain jobs (Sales, Marketing, HR, Finance, Operations, Design, Healthcare, etc.)
 * do NOT include Coding Rounds in their pipeline or candidate portal tracking.
 */
export function isTechDomain(category?: string | null, title?: string | null): boolean {
  const cat = (category || "").toLowerCase().trim();
  const t = (title || "").toLowerCase().trim();

  // If neither category nor title is provided, default to tech
  if (!cat && !t) return true;

  // Explicit Non-Tech domain keywords
  const nonTechKeywords = [
    "sales",
    "marketing",
    "human resources",
    "hr",
    "recruitment",
    "talent acquisition",
    "finance",
    "accounting",
    "legal",
    "compliance",
    "customer support",
    "customer success",
    "customer service",
    "operations",
    "business development",
    "content",
    "copywriter",
    "graphic design",
    "healthcare",
    "nursing",
    "medical",
    "logistics",
    "administrative",
    "admin",
    "management",
    "hospitality",
    "public relations",
    "pr",
  ];

  // Explicit Tech domain keywords
  const techKeywords = [
    "tech",
    "technology",
    "software",
    "developer",
    "engineering",
    "engineer",
    "full stack",
    "fullstack",
    "frontend",
    "backend",
    "web dev",
    "mobile dev",
    "ios",
    "android",
    "devops",
    "data science",
    "data engineer",
    "ai/ml",
    "machine learning",
    "cloud",
    "coder",
    "coding",
    "qa engineer",
    "tester",
    "system architect",
  ];

  const hasTech = techKeywords.some((kw) => cat.includes(kw) || t.includes(kw));
  const hasNonTech = nonTechKeywords.some((kw) => cat.includes(kw) || t.includes(kw));

  // If explicitly non-tech and does not contain tech keywords -> Non-Tech
  if (hasNonTech && !hasTech) {
    return false;
  }

  return true; // Default to tech
}
