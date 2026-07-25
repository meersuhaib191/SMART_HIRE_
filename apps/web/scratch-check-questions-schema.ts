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

async function checkSchema() {
  console.log("Checking assessment.questions...");
  const { data, error } = await supabase.schema("assessment").from("questions").select("*").limit(5);
  console.log("Error:", error);
  console.log("Rows:", data);
}

checkSchema().then(() => process.exit(0)).catch(console.error);
