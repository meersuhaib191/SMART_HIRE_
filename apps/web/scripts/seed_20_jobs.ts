import { createClient } from "@supabase/supabase-js";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

interface RecruiterSeed {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  title: string;
  companyName: string;
  companyDomain: string;
  companyIndustry: string;
  companySize: string;
}

const recruiterSeeds: RecruiterSeed[] = [
  {
    email: "suhaib.recruiter@smarthire.ai",
    password: "Password123!",
    firstName: "Mir",
    lastName: "Suhaib",
    title: "Senior Talent Acquisition Director",
    companyName: "Waadi Media Technologies",
    companyDomain: "waadimedia.com",
    companyIndustry: "Software Engineering & Digital Media",
    companySize: "51-200",
  },
  {
    email: "faizan.recruiter@smarthire.ai",
    password: "Password123!",
    firstName: "Mir",
    lastName: "Faizan",
    title: "VP of Engineering & Cybersecurity Talent",
    companyName: "Kashmir CyberLabs",
    companyDomain: "kashmircyberlabs.io",
    companyIndustry: "Cybersecurity & Cloud Defense",
    companySize: "11-50",
  },
  {
    email: "musaib.recruiter@smarthire.ai",
    password: "Password123!",
    firstName: "Mir",
    lastName: "Musaib",
    title: "Head of AI & Data Science Hiring",
    companyName: "Apex AI Solutions",
    companyDomain: "apexaisolutions.ai",
    companyIndustry: "Artificial Intelligence & LLM Research",
    companySize: "51-200",
  },
  {
    email: "furkan.recruiter@smarthire.ai",
    password: "Password123!",
    firstName: "Furkan",
    lastName: "Mushtaq",
    title: "Lead Product & Design Talent Partner",
    companyName: "Starlight Interactive",
    companyDomain: "starlightinteractive.com",
    companyIndustry: "UI/UX Design & Mobile Products",
    companySize: "201-500",
  },
  {
    email: "khalid.recruiter@smarthire.ai",
    password: "Password123!",
    firstName: "Khalid",
    lastName: "Bin Bashir",
    title: "Director of Global Cloud Engineering Hiring",
    companyName: "Northern Valley Cloud",
    companyDomain: "northernvalleycloud.com",
    companyIndustry: "DevOps, SRE & Cloud Infrastructure",
    companySize: "500+",
  },
];

interface JobSeed {
  recruiterEmail: string;
  title: string;
  category: string;
  type: "full-time" | "part-time" | "contract" | "internship";
  experienceLevel: "entry" | "mid" | "senior" | "lead" | "executive";
  location: string;
  remotePolicy: "remote" | "hybrid" | "onsite";
  salaryMin: number;
  salaryMax: number;
  description: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
}

const jobSeeds: JobSeed[] = [
  // Mir Suhaib Jobs (Waadi Media Technologies)
  {
    recruiterEmail: "suhaib.recruiter@smarthire.ai",
    title: "Senior Full Stack Engineer (Next.js & TypeScript)",
    category: "Software Engineering",
    type: "full-time",
    experienceLevel: "senior",
    location: "San Francisco, CA / Remote",
    remotePolicy: "remote",
    salaryMin: 135000,
    salaryMax: 165000,
    description: "Join Waadi Media Technologies to build high-concurrency web applications powering next-generation video streaming and interactive dashboards.",
    responsibilities: "Architect end-to-end features using Next.js 15, TypeScript, React 19, and TailwindCSS. Integrate real-time WebSockets and Supabase backend services.",
    requirements: "5+ years of experience with modern React/Next.js, TypeScript, PostgreSQL, and Node.js microservices.",
    benefits: "Full healthcare, 401(k) matching, unlimited PTO, $2,000 annual learning stipend.",
  },
  {
    recruiterEmail: "suhaib.recruiter@smarthire.ai",
    title: "Senior Backend Systems Architect (Go & Distributed Systems)",
    category: "Software Engineering",
    type: "full-time",
    experienceLevel: "lead",
    location: "San Francisco, CA / Remote",
    remotePolicy: "remote",
    salaryMin: 150000,
    salaryMax: 185000,
    description: "Lead the core platform team responsible for building low-latency microservices handling millions of API calls daily.",
    responsibilities: "Design high-performance Golang services, optimize PostgreSQL and Redis caching layers, implement gRPC protocols.",
    requirements: "6+ years experience in Golang or Rust, distributed caching, database indexing, and Kubernetes orchestration.",
    benefits: "Stock options, premium health coverage, flexible remote work stipend.",
  },
  {
    recruiterEmail: "suhaib.recruiter@smarthire.ai",
    title: "Growth Digital Marketing & Analytics Director",
    category: "Marketing",
    type: "full-time",
    experienceLevel: "lead",
    location: "San Francisco, CA",
    remotePolicy: "hybrid",
    salaryMin: 110000,
    salaryMax: 140000,
    description: "Drive user acquisition strategies, SEO, and paid media funnels for our digital media SaaS ecosystem.",
    responsibilities: "Manage multi-channel marketing campaigns, optimize CAC/LTV metrics, and lead content growth teams.",
    requirements: "4+ years in B2B SaaS growth marketing, Google Analytics 4, Mixpanel, and performance advertising.",
    benefits: "Competitive base + performance bonus, health & wellness coverage.",
  },
  {
    recruiterEmail: "suhaib.recruiter@smarthire.ai",
    title: "Financial Data Analyst & Business Intelligence Specialist",
    category: "Finance Analytics",
    type: "full-time",
    experienceLevel: "mid",
    location: "Remote",
    remotePolicy: "remote",
    salaryMin: 95000,
    salaryMax: 125000,
    description: "Analyze financial revenue streams, forecast enterprise subscription metrics, and build executive Tableau dashboards.",
    responsibilities: "Perform financial modeling, SQL queries on BigQuery, and collaborate with executive leadership on growth targets.",
    requirements: "3+ years in financial analysis, advanced SQL, Tableau/PowerBI, and financial modeling.",
    benefits: "Flexible working hours, home office setup budget, medical insurance.",
  },

  // Mir Faizan Jobs (Kashmir CyberLabs)
  {
    recruiterEmail: "faizan.recruiter@smarthire.ai",
    title: "Principal Cybersecurity Architect (SOC & Threat Defense)",
    category: "Cybersecurity",
    type: "full-time",
    experienceLevel: "lead",
    location: "Srinagar, Kashmir / Remote",
    remotePolicy: "remote",
    salaryMin: 145000,
    salaryMax: 185000,
    description: "Protect global infrastructure at Kashmir CyberLabs. Design zero-trust security architecture, SIEM automation, and incident response systems.",
    responsibilities: "Lead vulnerability management, perform penetration testing audits, and implement automated SOC response playbooks.",
    requirements: "7+ years in Information Security, CISSP/CEH certifications, AWS Security Hub, and SIEM tools (Splunk, Elastic).",
    benefits: "Generous equity, annual security conference tickets, premium health coverage.",
  },
  {
    recruiterEmail: "faizan.recruiter@smarthire.ai",
    title: "Lead QA Automation Engineer (Cypress & Playwright)",
    category: "Quality Assurance",
    type: "full-time",
    experienceLevel: "senior",
    location: "Srinagar, Kashmir / Remote",
    remotePolicy: "remote",
    salaryMin: 100000,
    salaryMax: 130000,
    description: "Build robust end-to-end automation frameworks testing complex security platforms and web applications.",
    responsibilities: "Design automated test suites in TypeScript using Playwright and Cypress. Integrate test suites into GitHub Actions CI/CD.",
    requirements: "4+ years experience in web automation testing, CI/CD pipeline integration, and API testing (Postman/K6).",
    benefits: "Flexible hours, equipment allowance, performance bonuses.",
  },
  {
    recruiterEmail: "faizan.recruiter@smarthire.ai",
    title: "Database Administrator (PostgreSQL & CockroachDB)",
    category: "Database Engineering",
    type: "full-time",
    experienceLevel: "senior",
    location: "Remote",
    remotePolicy: "remote",
    salaryMin: 120000,
    salaryMax: 150000,
    description: "Maintain multi-region PostgreSQL and CockroachDB clusters with zero-downtime replication and high availability.",
    responsibilities: "Tune database query performance, manage WAL archiving, plan failover strategies, and execute database schema migrations.",
    requirements: "5+ years deep expertise with PostgreSQL internals, replication topologies, query optimization, and pgbouncer.",
    benefits: "Full health coverage, flexible PTO, tech setup allowance.",
  },
  {
    recruiterEmail: "faizan.recruiter@smarthire.ai",
    title: "Penetration Tester & Offensive Security Engineer",
    category: "Cybersecurity",
    type: "full-time",
    experienceLevel: "mid",
    location: "Srinagar, Kashmir / Remote",
    remotePolicy: "hybrid",
    salaryMin: 125000,
    salaryMax: 160000,
    description: "Conduct offensive security audits, web application penetration tests, and red team exercises for enterprise clients.",
    responsibilities: "Identify OWASP Top 10 vulnerabilities, write proof-of-concept exploits, and author comprehensive security audit reports.",
    requirements: "OSCP, OSCE, or GWAPT certification. Strong scripting skills in Python/Bash and web application security auditing.",
    benefits: "Competitive salary, certification sponsorship, remote options.",
  },

  // Mir Musaib Jobs (Apex AI Solutions)
  {
    recruiterEmail: "musaib.recruiter@smarthire.ai",
    title: "Lead AI / Machine Learning Scientist (LLMs & RAG)",
    category: "Artificial Intelligence",
    type: "full-time",
    experienceLevel: "lead",
    location: "Bengaluru, India / Remote",
    remotePolicy: "remote",
    salaryMin: 170000,
    salaryMax: 210000,
    description: "Innovate cutting-edge generative AI models, Retrieval-Augmented Generation (RAG) pipelines, and agentic workflows at Apex AI Solutions.",
    responsibilities: "Train and fine-tune open-source LLMs (Llama-3, Qwen), optimize vector database indexing (Milvus, pgvector), and deploy model inferencing services.",
    requirements: "M.S. or Ph.D. in CS/AI, 5+ years experience with PyTorch, LangChain/LlamaIndex, TensorRT-LLM, and vLLM.",
    benefits: "Founding team equity, unlimited AI compute credits, comprehensive health cover.",
  },
  {
    recruiterEmail: "musaib.recruiter@smarthire.ai",
    title: "NLP & Large Language Model Research Engineer",
    category: "Artificial Intelligence",
    type: "full-time",
    experienceLevel: "senior",
    location: "Bengaluru, India / Remote",
    remotePolicy: "remote",
    salaryMin: 160000,
    salaryMax: 195000,
    description: "Research novel transformer architectures, prompt optimization frameworks, and multi-modal AI models.",
    responsibilities: "Conduct experiments on synthetic dataset generation, RLHF fine-tuning, and model quantization for edge deployment.",
    requirements: "Strong background in PyTorch, HuggingFace, CUDA acceleration, and deep learning math.",
    benefits: "Top-tier compensation package, global conference travel sponsorship.",
  },
  {
    recruiterEmail: "musaib.recruiter@smarthire.ai",
    title: "Big Data & Data Engineering Manager",
    category: "Data Engineering",
    type: "full-time",
    experienceLevel: "lead",
    location: "Bengaluru, India",
    remotePolicy: "hybrid",
    salaryMin: 150000,
    salaryMax: 190000,
    description: "Lead the data engineering org constructing petabyte-scale data pipelines and real-time streaming architectures.",
    responsibilities: "Architect Apache Spark, Kafka, and Snowflake data warehouses. Manage a team of 8 data engineers.",
    requirements: "6+ years leading data engineering teams, expertise in PySpark, dbt, Airflow, and Cloud Data Lakehouses.",
    benefits: "Executive health benefits, annual performance bonuses, stock options.",
  },
  {
    recruiterEmail: "musaib.recruiter@smarthire.ai",
    title: "Technical Product Manager (AI & ML Platform)",
    category: "Product Management",
    type: "full-time",
    experienceLevel: "senior",
    location: "Remote",
    remotePolicy: "remote",
    salaryMin: 140000,
    salaryMax: 175000,
    description: "Define the product roadmap for enterprise AI developer tools, APIs, and automated candidate assessment engines.",
    responsibilities: "Gather customer requirements, write technical spec PRDs, and partner closely with AI research engineers.",
    requirements: "4+ years as Product Manager for developer-facing APIs or AI platforms. Strong technical background.",
    benefits: "Remote work stipend, health insurance, flexible vacation policy.",
  },

  // Furkan Mushtaq Jobs (Starlight Interactive)
  {
    recruiterEmail: "furkan.recruiter@smarthire.ai",
    title: "Staff UI/UX Product Designer",
    category: "Product Design",
    type: "full-time",
    experienceLevel: "senior",
    location: "London, UK / Remote",
    remotePolicy: "remote",
    salaryMin: 115000,
    salaryMax: 145000,
    description: "Craft world-class user interfaces, dynamic design systems, and micro-interactions for Starlight Interactive's digital web & mobile apps.",
    responsibilities: "Design responsive Figma component libraries, conduct user research, build interactive prototypes, and collaborate with front-end engineers.",
    requirements: "5+ years in product design, mastery of Figma, HTML/CSS animation principles, and design system governance.",
    benefits: "Competitive salary, Mac Studio setup budget, wellness allowance.",
  },
  {
    recruiterEmail: "furkan.recruiter@smarthire.ai",
    title: "Senior Mobile App Developer (React Native / Cross-Platform)",
    category: "Mobile Engineering",
    type: "full-time",
    experienceLevel: "senior",
    location: "London, UK / Remote",
    remotePolicy: "remote",
    salaryMin: 125000,
    salaryMax: 155000,
    description: "Build high-performance iOS and Android applications utilizing React Native, Expo, and native Swift/Kotlin modules.",
    responsibilities: "Develop smooth 60fps mobile interfaces, handle offline state synchronization, and manage App Store / Play Store releases.",
    requirements: "4+ years with React Native, TypeScript, Redux/Zustand, and native iOS/Android bridge development.",
    benefits: "Full health coverage, flexible workspace budget, annual company retreats.",
  },
  {
    recruiterEmail: "furkan.recruiter@smarthire.ai",
    title: "Lead Front-End Architect (React & WebGL)",
    category: "Software Engineering",
    type: "full-time",
    experienceLevel: "lead",
    location: "London, UK / Remote",
    remotePolicy: "remote",
    salaryMin: 135000,
    salaryMax: 170000,
    description: "Push the boundaries of web UI performance by designing 3D interactive graphics, shaders, and complex web applications.",
    responsibilities: "Drive front-end architecture, Three.js / WebGL canvas rendering, component performance optimization, and web accessibility.",
    requirements: "6+ years modern JavaScript/TypeScript, React, Three.js/GLSL, and web performance profiling.",
    benefits: "Stock options, remote flexibility, top-tier equipment.",
  },
  {
    recruiterEmail: "furkan.recruiter@smarthire.ai",
    title: "Enterprise Account Executive & Technical Sales Lead",
    category: "Sales & BD",
    type: "full-time",
    experienceLevel: "senior",
    location: "London, UK",
    remotePolicy: "hybrid",
    salaryMin: 120000,
    salaryMax: 180000,
    description: "Close enterprise SaaS deals, manage key client accounts, and partner with solution architects to demonstrate software solutions.",
    responsibilities: "Own full sales cycle from lead qualification to contract execution. Achieve quarterly quota targets.",
    requirements: "4+ years in B2B SaaS enterprise sales, track record of exceeding $1M+ ARR quotas.",
    benefits: "Uncapped commission structure, company car allowance, health cover.",
  },

  // Khalid Bin Bashir Jobs (Northern Valley Cloud)
  {
    recruiterEmail: "khalid.recruiter@smarthire.ai",
    title: "Senior Cloud Infrastructure & DevOps Engineer",
    category: "Cloud Engineering",
    type: "full-time",
    experienceLevel: "senior",
    location: "New York, NY / Remote",
    remotePolicy: "remote",
    salaryMin: 135000,
    salaryMax: 170000,
    description: "Build robust Infrastructure-as-Code (Terraform), automate CI/CD pipelines, and scale Kubernetes clusters on AWS at Northern Valley Cloud.",
    responsibilities: "Provision multi-account AWS environments with Terraform, configure Helm charts, implement Prometheus/Grafana monitoring.",
    requirements: "5+ years in DevOps/SRE, deep proficiency with AWS, Terraform, Docker, Kubernetes, and GitHub Actions.",
    benefits: "401(k) with 5% match, full medical/dental, remote home office stipend.",
  },
  {
    recruiterEmail: "khalid.recruiter@smarthire.ai",
    title: "Site Reliability Engineer (SRE & Kubernetes Specialist)",
    category: "Cloud Engineering",
    type: "full-time",
    experienceLevel: "senior",
    location: "New York, NY / Remote",
    remotePolicy: "remote",
    salaryMin: 130000,
    salaryMax: 165000,
    description: "Maintain 99.99% service availability across multi-cloud infrastructure through automation and chaos engineering.",
    responsibilities: "Manage SLA/SLO/SLI metrics, automate incident recovery, conduct blameless post-mortems, and tune Linux kernel networking.",
    requirements: "4+ years in SRE roles, Python/Go scripting, Kubernetes administration, and distributed tracing (Jaeger/Datadog).",
    benefits: "Competitive salary, 100% employer-paid health premiums.",
  },
  {
    recruiterEmail: "khalid.recruiter@smarthire.ai",
    title: "Enterprise Solutions Architect (AWS / Azure)",
    category: "Enterprise IT",
    type: "full-time",
    experienceLevel: "lead",
    location: "New York, NY",
    remotePolicy: "hybrid",
    salaryMin: 165000,
    salaryMax: 205000,
    description: "Design mission-critical cloud migration strategies, hybrid cloud connectivity, and enterprise security frameworks for Fortune 500 clients.",
    responsibilities: "Author architectural blueprints, advise CTOs on cloud migration, and oversee enterprise implementation projects.",
    requirements: "7+ years as Cloud Architect, AWS Certified Solutions Architect Professional, deep enterprise networking knowledge.",
    benefits: "Executive equity package, premium health & dental, flexible travel budget.",
  },
  {
    recruiterEmail: "khalid.recruiter@smarthire.ai",
    title: "Senior HR Operations & People Analytics Manager",
    category: "Human Resources",
    type: "full-time",
    experienceLevel: "senior",
    location: "New York, NY",
    remotePolicy: "hybrid",
    salaryMin: 95000,
    salaryMax: 125000,
    description: "Oversee global HR operations, employee onboarding programs, talent retention analytics, and workplace compliance.",
    responsibilities: "Manage HRIS platform data, optimize recruiter workflows, analyze employee engagement metrics, and implement HR policies.",
    requirements: "5+ years in HR management, HRIS platforms (Workday/BambooHR), and data-driven workforce planning.",
    benefits: "Healthcare coverage, transit benefits, generous PTO.",
  },
];

async function seedDatabase() {
  console.log("🚀 Starting database seeding for 5 Recruiters and 20 Jobs across domains...\n");

  const recruiterMap = new Map<string, { userId: string; companyId: string; recruiterId: string; client: any }>();

  for (const rec of recruiterSeeds) {
    console.log(`Processing Recruiter Profile: ${rec.firstName} ${rec.lastName} (${rec.email})...`);

    // Create a new Supabase client instance for each recruiter to preserve session context
    const supabase = createClient(REAL_URL, REAL_KEY);

    // 1. Sign up user via Auth API if not existing
    let userId: string | null = null;
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: rec.email,
      password: rec.password,
      options: {
        data: {
          first_name: rec.firstName,
          last_name: rec.lastName,
          full_name: `${rec.firstName} ${rec.lastName}`,
          role: "recruiter",
          company_name: rec.companyName,
        },
      },
    });

    if (signUpData?.user) {
      userId = signUpData.user.id;
    }

    // Always sign in to get an authenticated session for RLS policy compliance
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: rec.email,
      password: rec.password,
    });

    if (signInData?.user) {
      userId = signInData.user.id;
    } else if (!userId) {
      console.error(`❌ Could not authenticate ${rec.email}:`, signInErr?.message || signUpErr?.message);
      continue;
    }

    // 2. Ensure company exists in organization.companies
    let companyId: string | null = null;
    const { data: existingComp } = await supabase
      .schema("organization")
      .from("companies")
      .select("id")
      .eq("name", rec.companyName)
      .maybeSingle();

    if (existingComp) {
      companyId = existingComp.id;
      await supabase
        .schema("organization")
        .from("companies")
        .update({
          domain: rec.companyDomain,
          industry: rec.companyIndustry,
          company_size: rec.companySize,
        })
        .eq("id", existingComp.id);
    } else {
      const { data: newComp, error: compErr } = await supabase
        .schema("organization")
        .from("companies")
        .insert({
          name: rec.companyName,
          domain: rec.companyDomain,
          industry: rec.companyIndustry,
          company_size: rec.companySize,
        })
        .select("id")
        .single();

      if (newComp) companyId = newComp.id;
      if (compErr) console.error(`Error creating company ${rec.companyName}:`, compErr);
    }

    if (!companyId) continue;

    // 3. Link recruiter in organization.recruiters
    let recruiterId: string | null = null;
    const { data: existingRec } = await supabase
      .schema("organization")
      .from("recruiters")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRec) {
      recruiterId = existingRec.id;
      await supabase
        .schema("organization")
        .from("recruiters")
        .update({
          company_id: companyId,
          title: rec.title,
          role: "recruiter",
        })
        .eq("id", existingRec.id);
    } else {
      const { data: newRec, error: recErr } = await supabase
        .schema("organization")
        .from("recruiters")
        .insert({
          user_id: userId,
          company_id: companyId,
          title: rec.title,
          role: "recruiter",
        })
        .select("id")
        .single();

      if (newRec) recruiterId = newRec.id;
      if (recErr) console.error(`Error creating recruiter record for ${rec.email}:`, recErr);
    }

    if (recruiterId && companyId) {
      recruiterMap.set(rec.email, { userId, companyId, recruiterId, client: supabase });
      console.log(`✅ Recruiter Ready: ${rec.firstName} ${rec.lastName} | Company ID: ${companyId}`);
    }
  }

  console.log("\n=======================================================");
  console.log("📌 CREATING 20 TEST JOBS ACROSS DOMAINS...");
  console.log("=======================================================\n");

  let createdCount = 0;

  for (let i = 0; i < jobSeeds.length; i++) {
    const job = jobSeeds[i];
    const recInfo = recruiterMap.get(job.recruiterEmail);
    if (!recInfo) {
      console.error(`Skipping job '${job.title}': recruiter ${job.recruiterEmail} not ready.`);
      continue;
    }

    const { client } = recInfo;

    // Check if job with title already exists for this company
    const { data: existingJob } = await client
      .schema("job")
      .from("jobs")
      .select("id")
      .eq("company_id", recInfo.companyId)
      .eq("title", job.title)
      .maybeSingle();

    if (existingJob) {
      console.log(`[${i + 1}/20] Job already exists: "${job.title}"`);
      createdCount++;
      continue;
    }

    const { data: newJob, error: jobErr } = await client
      .schema("job")
      .from("jobs")
      .insert({
        company_id: recInfo.companyId,
        created_by_recruiter_id: recInfo.recruiterId,
        title: job.title,
        category: job.category,
        type: job.type,
        experience_level: job.experienceLevel,
        location: job.location,
        remote_policy: job.remotePolicy,
        salary_min: job.salaryMin,
        salary_max: job.salaryMax,
        salary_currency: "USD",
        description: job.description,
        responsibilities: job.responsibilities,
        requirements: job.requirements,
        benefits: job.benefits,
        status: "published",
      })
      .select("id")
      .single();

    if (newJob) {
      createdCount++;
      console.log(`[${i + 1}/20] ✅ Created Job: "${job.title}" (${job.category})`);
    } else {
      console.error(`[${i + 1}/20] ❌ Failed to create job "${job.title}":`, jobErr?.message);
    }
  }

  console.log(`\n🎉 SEEDING FINISHED! Created/Verified ${createdCount} jobs across 5 Recruiter Profiles.`);
}

seedDatabase().catch((err) => {
  console.error("Seeding failed with error:", err);
});
