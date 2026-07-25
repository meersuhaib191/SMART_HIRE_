import { createClient } from "./src/utils/supabase/client";

async function inspectDbTables() {
  const supabase = createClient();

  const { data: comp } = await supabase.schema("organization").from("companies").select("id, name");
  console.log("Companies:", comp?.length, comp?.map(c => c.name));

  const { data: rec } = await supabase.schema("organization").from("recruiters").select("id, first_name, last_name");
  console.log("Recruiters:", rec?.length, rec?.map(r => `${r.first_name} ${r.last_name}`));

  const { data: cands, error: candErr } = await supabase.schema("candidate").from("candidates").select("id, first_name, last_name, email, created_at");
  console.log("Candidates:", cands?.length, "Error:", candErr?.message, cands);

  const { data: apps, error: appErr } = await supabase.schema("application").from("applications").select("id, status, created_at");
  console.log("Applications:", apps?.length, "Error:", appErr?.message, apps);

  const { data: jobs } = await supabase.schema("job").from("jobs").select("id, title, status");
  console.log("Jobs:", jobs?.length, "Statuses:", jobs?.map(j => j.status));
}

inspectDbTables().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
