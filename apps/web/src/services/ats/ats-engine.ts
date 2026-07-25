/**
 * ATS Core Engine — Ported from smart-hire-app ATS screening architecture
 * Multi-Factor Weighted Scoring Engine (Skills 45%, Semantic 30%, Experience 15%, Text 10%)
 */

export interface AtsFeatureVector {
  semanticSimilarity: number; // 0-1
  skillOverlap: number; // 0-1
  experienceScore: number; // 0-1
  textSimilarity: number; // 0-1
}

export interface AtsScoreBreakdown {
  atsScore: number; // 0-100
  passed: boolean; // >= passScore threshold (default 60)
  confidence: number; // 0-100%
  consistencyScore: number; // 0-100%
  features: AtsFeatureVector;
  matchedSkills: string[];
  missingSkills: string[];
  candidateSkills: string[];
  requiredSkills: string[];
  insights: string[];
  recommendations: string[];
}

// Built-in Skill Ontology for tech, data science, and non-tech domains
const SKILL_ONTOLOGY: Record<string, string[]> = {
  // Web & Software Development
  REACT: ["react", "react.js", "reactjs"],
  TYPESCRIPT: ["typescript"],
  JAVASCRIPT: ["javascript", "ecmascript"],
  NEXTJS: ["next.js", "nextjs"],
  NODEJS: ["node.js", "nodejs"],
  EXPRESS: ["express.js", "expressjs"],
  PYTHON: ["python"],
  JAVA: ["java"],
  CSHARP: ["c#", "csharp", ".net", "dotnet"],
  CPP: ["c++", "cpp"],
  GOLANG: ["golang"],
  RUST: ["rust"],
  SQL: ["sql", "structured query language", "mysql", "postgresql", "postgres", "sqlite", "tsql"],
  NOSQL: ["nosql", "mongodb", "dynamodb", "redis", "cassandra"],
  GRAPHQL: ["graphql"],
  REST_API: ["rest", "restful", "rest api", "apis"],
  HTML: ["html", "html5"],
  CSS: ["css", "css3", "tailwind", "tailwindcss", "bootstrap", "sass"],
  DOCKER: ["docker", "containerization"],
  KUBERNETES: ["kubernetes", "k8s"],
  AWS: ["aws", "amazon web services", "ec2", "s3"],
  AZURE: ["azure", "microsoft azure"],
  GCP: ["gcp", "google cloud", "google cloud platform"],
  CI_CD: ["ci/cd", "ci-cd", "github actions", "jenkins", "gitlab ci"],
  GIT: ["git", "github", "gitlab", "bitbucket"],

  // Data Science, Machine Learning & AI
  DATA_SCIENCE: ["data science", "data scientist"],
  DATA_ANALYSIS: ["data analysis", "data analytics", "exploratory data analysis", "eda"],
  MACHINE_LEARNING: ["machine learning", "statistical modeling", "predictive modeling"],
  DEEP_LEARNING: ["deep learning", "neural networks", "cnn", "rnn", "transformer"],
  PANDAS: ["pandas"],
  NUMPY: ["numpy"],
  SCIKIT_LEARN: ["scikit-learn", "sklearn"],
  TENSORFLOW: ["tensorflow"],
  PYTORCH: ["pytorch"],
  KERAS: ["keras"],
  STATISTICS: ["statistics", "statistical analysis", "hypothesis testing", "probability", "regression"],
  DATA_VISUALIZATION: ["data visualization", "matplotlib", "seaborn", "plotly", "d3"],
  BIG_DATA: ["apache spark", "spark", "hadoop", "bigquery", "snowflake"],
  NLP: ["nlp", "natural language processing", "text mining", "spacy", "nltk", "llm"],
  COMPUTER_VISION: ["computer vision", "opencv", "image processing"],
  R_PROGRAMMING: ["r programming", "r language", "r-project"],

  // Analytics & BI
  POWER_BI: ["power bi", "powerbi"],
  TABLEAU: ["tableau"],
  EXCEL: ["excel", "ms excel", "microsoft excel"],

  // Marketing & Sales
  SEO: ["seo", "search engine optimization"],
  CONTENT_MARKETING: ["content marketing", "copywriting"],
  DIGITAL_MARKETING: ["digital marketing", "google ads", "social media marketing"],
  SALES_STRATEGY: ["sales", "b2b sales", "crm", "salesforce", "lead generation"],

  // HR & Operations
  RECRUITMENT: ["recruitment", "talent acquisition", "sourcing", "ats"],
  HR_MANAGEMENT: ["hr", "human resources", "employee relations", "onboarding"],
  PROJECT_MANAGEMENT: ["project management", "agile", "scrum", "jira", "pmp"],
  FINANCIAL_ANALYSIS: ["financial analysis", "accounting", "budgeting", "forecasting"],
};

/**
 * Extracts normalized skills from text using ontology dictionary and regex matching.
 */
export function extractSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const [canonical, aliases] of Object.entries(SKILL_ONTOLOGY)) {
    for (const alias of aliases) {
      const escaped = alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}(?:$|[^a-zA-Z0-9_])`, "i");
      if (regex.test(lower)) {
        found.add(canonical.replace(/_/g, " "));
        break;
      }
    }
  }

  return Array.from(found);
}

/**
 * Calculates n-gram term frequency vector cosine similarity between candidate resume & job text.
 */
function computeTextSimilarity(textA: string, textB: string): number {
  const tokenize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0.2;

  // Build Unigram & Bigram frequency maps
  const getNGrams = (tokens: string[]) => {
    const map = new Map<string, number>();
    for (let i = 0; i < tokens.length; i++) {
      const uni = tokens[i];
      map.set(uni, (map.get(uni) || 0) + 1);
      if (i < tokens.length - 1) {
        const bi = `${tokens[i]} ${tokens[i + 1]}`;
        map.set(bi, (map.get(bi) || 0) + 1.5);
      }
    }
    return map;
  };

  const mapA = getNGrams(tokensA);
  const mapB = getNGrams(tokensB);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  mapA.forEach((val, key) => {
    normA += val * val;
    if (mapB.has(key)) {
      dotProduct += val * (mapB.get(key) || 0);
    }
  });

  mapB.forEach((val) => {
    normB += val * val;
  });

  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.min(1.0, Math.max(0.0, similarity));
}

/**
 * Estimates years of experience from text using pattern matching.
 */
function extractYearsOfExperience(text: string): number {
  const match = text.match(/(\d+)\+?\s*(?:years?|yrs?)\b/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  // Heuristic count of date ranges like 2020-2023
  const dateRanges = text.match(/\b(20\d\d)\s*[-–—to]+\s*(20\d\d|present|current)\b/gi);
  if (dateRanges) {
    return Math.min(15, dateRanges.length * 2);
  }
  return 2; // Default baseline fallback
}

export const ATSEngine = {
  /**
   * Main ATS Evaluation logic
   * Implements 4-Factor Weighted Algorithm:
   *  - Skill Overlap (45%)
   *  - Semantic Alignment (30%)
   *  - Experience Match (15%)
   *  - Text Similarity (10%)
   */
  evaluate: (
    resumeText: string,
    jobText: string,
    passThresholdScore = 60
  ): AtsScoreBreakdown => {
    const resumeClean = resumeText || "";
    const jobClean = jobText || "";

    // 1. Skill Extraction & Overlap Calculation
    const candidateSkills = extractSkillsFromText(resumeClean);
    const requiredSkills = extractSkillsFromText(jobClean);

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    if (requiredSkills.length > 0) {
      for (const skill of requiredSkills) {
        if (candidateSkills.includes(skill)) {
          matchedSkills.push(skill);
        } else {
          missingSkills.push(skill);
        }
      }
    }

    let skillOverlap =
      requiredSkills.length > 0
        ? matchedSkills.length / requiredSkills.length
        : candidateSkills.length > 0
        ? 0.7
        : 0.4;

    // Anti-inflation rule from smart-hire-app: clamp long lists to 0.92 if perfect
    if (requiredSkills.length >= 8 && skillOverlap >= 0.99) {
      skillOverlap = 0.92;
    }

    // 2. Text Similarity (TF-IDF N-Gram Cosine)
    const textSim = computeTextSimilarity(resumeClean, jobClean);

    // 3. Semantic Similarity Alignment
    // Derived from TF-IDF term overlap boosted by skill overlap
    let semanticSim = Math.min(1.0, 0.4 * textSim + 0.6 * skillOverlap);
    if (semanticSim > 0.8) semanticSim *= 0.95;

    // 4. Experience Feature Score
    const candExp = extractYearsOfExperience(resumeClean);
    const reqExp = extractYearsOfExperience(jobClean);
    let experienceScore = 1.0;
    if (reqExp > 0) {
      experienceScore = Math.max(0.3, Math.min(1.0, candExp / reqExp));
    }

    // 5. Weighted Combination (45% Skills, 30% Semantic, 15% Exp, 10% Text)
    const weights = {
      skills: 0.45,
      semantic: 0.30,
      experience: 0.15,
      text: 0.10,
    };

    let rawScore =
      weights.skills * skillOverlap +
      weights.semantic * semanticSim +
      weights.experience * experienceScore +
      weights.text * textSim;

    // Cap at 0.95 to maintain realism
    rawScore = Math.min(0.95, Math.max(0.1, rawScore));
    const finalAtsScore = Math.round(rawScore * 100);

    // 6. Consistency & Confidence Calculation
    const values = [semanticSim, skillOverlap, experienceScore, textSim];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const consistencyScore = Math.max(0, Math.min(1, 1 - stdDev / 0.5));
    const confidenceScore = Math.max(
      0,
      Math.min(1, 0.5 * skillOverlap + 0.3 * semanticSim + 0.2 * consistencyScore)
    );

    // 7. Generate Insights & Recommendations
    const insights: string[] = [];
    insights.push(`Skill Overlap: ${Math.round(skillOverlap * 100)}% (${matchedSkills.length}/${requiredSkills.length || 1} required skills present)`);
    insights.push(`Semantic Alignment: ${Math.round(semanticSim * 100)}%`);
    insights.push(`Experience Alignment: ${Math.round(experienceScore * 100)}% (Estimated candidate ${candExp} yrs vs job ${reqExp} yrs)`);

    if (semanticSim > 0.7) {
      insights.push("Strong alignment with core job responsibilities.");
    } else if (semanticSim > 0.4) {
      insights.push("Moderate alignment with job role expectations.");
    } else {
      insights.push("Weak semantic alignment with job responsibilities.");
    }

    const recommendations: string[] = [];
    if (missingSkills.length > 0) {
      recommendations.push(`Add key missing skills to your resume: ${missingSkills.slice(0, 4).join(", ")}.`);
    }
    if (experienceScore < 0.8) {
      recommendations.push(`Highlight relevant project timelines and lead experience to demonstrate ${reqExp}+ years of domain expertise.`);
    }
    if (textSim < 0.4) {
      recommendations.push("Incorporate industry standard keywords and action phrases matching the job posting text.");
    }
    if (recommendations.length === 0) {
      recommendations.push("Your resume is strongly optimized for this role! Ensure your contact info and portfolio links are current.");
    }

    return {
      atsScore: finalAtsScore,
      passed: finalAtsScore >= passThresholdScore,
      confidence: Math.round(confidenceScore * 100),
      consistencyScore: Math.round(consistencyScore * 100),
      features: {
        semanticSimilarity: Math.round(semanticSim * 100) / 100,
        skillOverlap: Math.round(skillOverlap * 100) / 100,
        experienceScore: Math.round(experienceScore * 100) / 100,
        textSimilarity: Math.round(textSim * 100) / 100,
      },
      matchedSkills,
      missingSkills,
      candidateSkills,
      requiredSkills,
      insights,
      recommendations,
    };
  },
};
