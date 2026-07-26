import { NextRequest, NextResponse } from "next/server";
import { createOrgClient } from "@/utils/supabase/organization";
import { createAdminClient } from "@/utils/supabase/admin";
import { createCompanySchema } from "@/services/organization-schemas";
import { logger } from "@smarthire/logger";

/**
 * GET: Retrieve all active companies associated with the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createOrgClient();

    // Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    logger.info(`Fetching companies associated with user: ${user.id}`);

    // Retrieve active recruiter ties for this user
    const { data: recruiters, error: queryError } = await supabase
      .from("recruiters")
      .select(`
        id,
        role,
        companies (
          id,
          name,
          slug,
          domain,
          logo_url,
          created_at
        )
      `)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (queryError) {
      logger.error("Query companies failed", queryError);
      return NextResponse.json({ error: "Failed to fetch companies list" }, { status: 500 });
    }

    // Map output to return clean company records
    const companies = (recruiters || [])
      .map((r: { companies: unknown }) => r.companies)
      .filter((c: unknown) => c !== null);

    return NextResponse.json({ data: companies });
  } catch (err) {
    logger.error("Internal server error in companies GET route", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST: Create a new company profile and register the creator as the Owner.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createOrgClient();

    // Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Parse and validate request payload
    const body = await request.json();
    const result = createCompanySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, slug, domain, logoUrl } = result.data;
    const baseSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
    const finalSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    logger.info(`Creating company profile: ${name} (slug: ${finalSlug}) by user: ${user.id}`);

    const adminSupabase = createAdminClient();

    // 1. Insert the company details using Admin Client
    const { data: company, error: companyError } = await adminSupabase
      .schema("organization")
      .from("companies")
      .insert({
        name,
        slug: finalSlug,
        domain: domain || null,
        logo_url: logoUrl || null,
        industry: result.data.industry || null,
        company_size: result.data.companySize || null,
        description: result.data.description || null,
      })
      .select()
      .single();

    if (companyError) {
      logger.error("Failed to insert company row", companyError);
      // Check for duplicate slug error
      if (companyError.code === "23505") {
        return NextResponse.json({ error: "Company slug already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to register company" }, { status: 500 });
    }

    // 2. Associate the creator in the recruiters table
    const { data: existingRec } = await adminSupabase
      .schema("organization")
      .from("recruiters")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    let recruiterError = null;
    if (existingRec) {
      const { error: updateErr } = await adminSupabase
        .schema("organization")
        .from("recruiters")
        .update({
          company_id: company.id,
          role: "owner",
        })
        .eq("id", existingRec.id);
      recruiterError = updateErr;
    } else {
      const { error: insertErr } = await adminSupabase
        .schema("organization")
        .from("recruiters")
        .insert({
          user_id: user.id,
          company_id: company.id,
          role: "owner",
        });
      recruiterError = insertErr;
    }

    if (recruiterError) {
      logger.error("Failed to insert owner recruiter record", recruiterError);
      await adminSupabase.schema("organization").from("companies").delete().eq("id", company.id);
      return NextResponse.json({ error: recruiterError.message || "Failed to link recruiter account" }, { status: 500 });
    }

    return NextResponse.json({ data: company }, { status: 201 });
  } catch (err) {
    logger.error("Internal server error in companies POST route", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
