import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  lines.forEach((line) => {
    const [key, val] = line.split("=");
    if (key && val) {
      process.env[key.trim()] = val.trim();
    }
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yljipgjfkfwacaspifcq.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, anonKey);

async function testMore() {
  const list = ["programming", "aptitude", "soft-skills", "domain", "system-design", "custom"];
  for (const c of list) {
    const { error } = await supabase.schema("assessment").from("questions").insert({
      assessment_id: "07924965-4658-4777-8a78-7e4e3477da58",
      question_text: "Test question",
      question_type: "mcq",
      options: ["A", "B"],
      correct_answer: "A",
      category: c
    });
    console.log(`Category "${c}":`, error ? error.message : "SUCCESS");
  }
}

testMore().then(() => process.exit(0)).catch(console.error);
