export async function resolveCandidateProfileIds(
  supabase: any,
  authUser: { id: string; email?: string | null; user_metadata?: any }
): Promise<string[]> {
  const idsSet = new Set<string>();
  if (authUser?.id) {
    idsSet.add(authUser.id);
  }

  if (!authUser?.id) {
    return Array.from(idsSet);
  }

  try {
    // 1. Query candidate.candidates by user_id
    const { data: byUserId } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("id, user_id, email")
      .eq("user_id", authUser.id);

    if (byUserId && byUserId.length > 0) {
      byUserId.forEach((c: { id: string }) => idsSet.add(c.id));
    }

    // 2. Query candidate.candidates by email (case-insensitive)
    if (authUser.email) {
      const { data: byEmail } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id, user_id, email")
        .ilike("email", authUser.email);

      if (byEmail && byEmail.length > 0) {
        for (const c of byEmail) {
          idsSet.add(c.id);
          // Sync user_id if missing or mismatching
          if (c.user_id !== authUser.id) {
            await supabase
              .schema("candidate")
              .from("candidates")
              .update({ user_id: authUser.id })
              .eq("id", c.id);
          }
        }
      }
    }

    // 3. If no profile exists at all, auto-create one
    if (byUserId?.length === 0 && (!authUser.email || (idsSet.size === 1 && idsSet.has(authUser.id)))) {
      const { data: byUserCheck } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (!byUserCheck) {
        const { data: newProfile } = await supabase
          .schema("candidate")
          .from("candidates")
          .insert({
            user_id: authUser.id,
            email: authUser.email || "",
            first_name: authUser.user_metadata?.first_name || authUser.email?.split("@")[0] || "Candidate",
            last_name: authUser.user_metadata?.last_name || "",
            summary: "",
            tags: ["React", "TypeScript"],
          })
          .select("id")
          .maybeSingle();

        if (newProfile) {
          idsSet.add(newProfile.id);
        }
      }
    }
  } catch (err) {
    console.error("Error resolving candidate profile IDs:", err);
  }

  return Array.from(idsSet);
}
