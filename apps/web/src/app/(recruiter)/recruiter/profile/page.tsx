"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@smarthire/ui";
import { Loader2, Building, UserCheck, Camera, Upload, Settings2, ArrowRight, Sparkles } from "lucide-react";
import { logger } from "@smarthire/logger";
import { SkeletonPageHeader, SkeletonCard } from "@/components/shared/Skeleton";

const supabase = createClient();

// Helper to compress uploaded avatar images to small canvas thumbnails (max 250x250px JPEG ~20KB)
const compressImage = (base64Str: string, maxWidth = 250, maxHeight = 250, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export default function RecruiterProfilePage() {
  const [loading, setLoading] = React.useState(true);
  const [_userId, setUserId] = React.useState<string | null>(null);

  // Recruiter Personal Specs
  const [recruiterFirstName, setRecruiterFirstName] = React.useState("");
  const [recruiterLastName, setRecruiterLastName] = React.useState("");
  const [recruiterTitle, setRecruiterTitle] = React.useState("Talent Acquisition Lead");
  const [recruiterEmail, setRecruiterEmail] = React.useState("");
  const [recruiterPhone, setRecruiterPhone] = React.useState("");
  const [recruiterAvatar, setRecruiterAvatar] = React.useState<string>("");
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);

  // Workspace Company Specs
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [companyName, setCompanyName] = React.useState("");
  const [companyDomain, setCompanyDomain] = React.useState("");
  const [companyIndustry, setCompanyIndustry] = React.useState("Software & Technology");
  const [companySize, setCompanySize] = React.useState("1-10");
  const [companyLocation, setCompanyLocation] = React.useState("");
  const [companyDescription, setCompanyDescription] = React.useState("");

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [savingCompany, setSavingCompany] = React.useState(false);
  const [isFirstTime, setIsFirstTime] = React.useState(false);

  const loadSettingsData = React.useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        setRecruiterEmail(user.email || "");

        const metaFirst = user.user_metadata?.first_name || "";
        const metaLast = user.user_metadata?.last_name || "";
        const fullName = user.user_metadata?.full_name || "";

        if (metaFirst) {
          setRecruiterFirstName(metaFirst);
        } else if (fullName) {
          const parts = fullName.split(" ");
          setRecruiterFirstName(parts[0] || "");
          setRecruiterLastName(parts.slice(1).join(" ") || "");
        } else if (user.email) {
          const parts = user.email.split("@")[0].split(/[\._\-]/);
          setRecruiterFirstName(parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Recruiter");
          setRecruiterLastName(parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "");
        }

        if (metaLast) setRecruiterLastName(metaLast);
        if (user.user_metadata?.company_name) setCompanyName(user.user_metadata.company_name);

        // Auto-clean bloated base64 avatar_url from Auth metadata cookie if present
        if (user.user_metadata?.avatar_url && user.user_metadata.avatar_url.length > 100) {
          try {
            await supabase.auth.updateUser({ data: { avatar_url: null } });
          } catch (e) {
            logger.warn("Cookie metadata cleanup skipped", e);
          }
        }

        // Clean up legacy un-scoped local profile if present
        try {
          localStorage.removeItem("smarthire_active_recruiter_profile");
        } catch {}

        // Check user-scoped saved local profile specs
        const savedProfileKey = `smarthire_active_recruiter_profile_${user.id}`;
        const savedProfile = localStorage.getItem(savedProfileKey);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.recruiterFirstName) setRecruiterFirstName(parsed.recruiterFirstName);
            if (parsed.recruiterLastName) setRecruiterLastName(parsed.recruiterLastName);
            if (parsed.recruiterTitle) setRecruiterTitle(parsed.recruiterTitle);
            if (parsed.recruiterEmail) setRecruiterEmail(parsed.recruiterEmail);
            if (parsed.recruiterPhone) setRecruiterPhone(parsed.recruiterPhone);
            if (parsed.recruiterAvatar) setRecruiterAvatar(parsed.recruiterAvatar);
            if (parsed.companyName) setCompanyName(parsed.companyName);
            if (parsed.companyDomain) setCompanyDomain(parsed.companyDomain);
            if (parsed.companyIndustry) setCompanyIndustry(parsed.companyIndustry);
            if (parsed.companySize) setCompanySize(parsed.companySize);
            if (parsed.companyLocation) setCompanyLocation(parsed.companyLocation);
            if (parsed.companyDescription) setCompanyDescription(parsed.companyDescription);
          } catch (e) {
            logger.error("Failed to parse saved profile specs", e);
          }
        }

        // Fetch user's recruiter record from database as primary source of truth
        const { data: recruiter } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("company_id, id, title, first_name, last_name, email, phone, avatar_url, profile_completed")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (recruiter) {
          if (recruiter.first_name) setRecruiterFirstName(recruiter.first_name);
          if (recruiter.last_name) setRecruiterLastName(recruiter.last_name);
          if (recruiter.email) setRecruiterEmail(recruiter.email);
          if (recruiter.phone) setRecruiterPhone(recruiter.phone);
          if (recruiter.title) setRecruiterTitle(recruiter.title);
          if (recruiter.avatar_url) setRecruiterAvatar(recruiter.avatar_url);

          if (!recruiter.profile_completed || !recruiter.company_id) {
            setIsFirstTime(true);
          }

          if (recruiter.company_id) {
            setCompanyId(recruiter.company_id);

            const { data: comp } = await supabase
              .schema("organization")
              .from("companies")
              .select("name, domain, industry, company_size, description, location")
              .eq("id", recruiter.company_id)
              .maybeSingle();

            if (comp) {
              if (comp.name) setCompanyName(comp.name);
              if (comp.domain) setCompanyDomain(comp.domain);
              if (comp.industry) setCompanyIndustry(comp.industry);
              if (comp.company_size) setCompanySize(comp.company_size);
              if (comp.description) setCompanyDescription(comp.description);
              if (comp.location) setCompanyLocation(comp.location);
            }
          }
        } else {
          setIsFirstTime(true);
        }
      }
    } catch (err) {
      logger.error("Failed to load workspace settings", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recruiterFirstName.trim() || !recruiterLastName.trim()) {
      setErrorMsg("First Name and Last Name are required.");
      return;
    }
    if (!companyName.trim()) {
      setErrorMsg("Company name is required to complete your employer profile.");
      return;
    }

    setSavingCompany(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const activeSpecs = {
        recruiterFirstName: recruiterFirstName.trim(),
        recruiterLastName: recruiterLastName.trim(),
        recruiterTitle: recruiterTitle.trim(),
        recruiterEmail: recruiterEmail.trim(),
        recruiterPhone: recruiterPhone.trim(),
        recruiterAvatar,
        companyName: companyName.trim(),
        companyDomain: companyDomain.trim(),
        companyIndustry: companyIndustry.trim(),
        companySize,
        companyLocation: companyLocation.trim(),
        companyDescription: companyDescription.trim(),
      };

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        throw new Error("You must be signed in to save profile settings.");
      }

      // Safe localStorage setter with QuotaExceeded fallback
      const safeSetLocalStorage = (key: string, dataObj: Record<string, unknown>) => {
        try {
          localStorage.setItem(key, JSON.stringify(dataObj));
        } catch (err) {
          logger.warn("LocalStorage setItem failed", err);
        }
      };

      const savedProfileKey = `smarthire_active_recruiter_profile_${authUser.id}`;
      safeSetLocalStorage(savedProfileKey, activeSpecs);

      // 1. Update Supabase Auth metadata & identity table
      try {
        await supabase.auth.updateUser({
          data: {
            first_name: recruiterFirstName.trim(),
            last_name: recruiterLastName.trim(),
            full_name: `${recruiterFirstName.trim()} ${recruiterLastName.trim()}`.trim(),
            company_name: companyName.trim(),
            avatar_url: recruiterAvatar?.startsWith("http") ? recruiterAvatar : null,
          }
        });

        await supabase
          .schema("identity")
          .from("users")
          .update({
            first_name: recruiterFirstName.trim(),
            last_name: recruiterLastName.trim(),
            email: recruiterEmail.trim(),
          })
          .eq("id", authUser.id);
      } catch (e) {
        logger.error("Failed to sync auth user specs", e);
      }

      // 2. Insert or Update Company & Recruiter records in database
      let activeCompanyId = companyId;

      if (activeCompanyId) {
        await supabase
          .schema("organization")
          .from("companies")
          .update({
            name: companyName.trim(),
            domain: companyDomain.trim() || null,
            industry: companyIndustry.trim() || null,
            company_size: companySize || null,
            description: companyDescription.trim() || null,
            location: companyLocation.trim() || null,
          })
          .eq("id", activeCompanyId);
      } else {
        const compSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
        const uniqueSlug = `${compSlug}-${Math.random().toString(36).substring(2, 7)}`;

        try {
          const apiRes = await fetch("/api/organization/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: companyName.trim(),
              slug: uniqueSlug,
              domain: companyDomain.trim() || null,
              industry: companyIndustry.trim() || null,
              companySize: companySize || null,
              description: companyDescription.trim() || null,
            }),
          });

          if (apiRes.ok) {
            const apiJson = await apiRes.json().catch(() => ({}));
            if (apiJson.data?.id) {
              activeCompanyId = apiJson.data.id;
              setCompanyId(apiJson.data.id);
            }
          } else {
            const errText = await apiRes.text().catch(() => "");
            logger.error(`API failed creating company: ${errText}`);
          }
        } catch (e) {
          logger.error("Error calling company creation API", e);
        }
      }

      // 3. Update or insert Recruiter record as SINGLE SOURCE OF TRUTH in database
      if (activeCompanyId) {
        const { data: existingRec } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        const recruiterPayload = {
          user_id: authUser.id,
          company_id: activeCompanyId,
          role: "recruiter",
          first_name: recruiterFirstName.trim(),
          last_name: recruiterLastName.trim(),
          email: recruiterEmail.trim(),
          phone: recruiterPhone.trim(),
          title: recruiterTitle.trim() || "Talent Acquisition Specialist",
          avatar_url: recruiterAvatar || null,
          profile_completed: true,
        };

        if (existingRec?.id) {
          const { error: recErr } = await supabase
            .schema("organization")
            .from("recruiters")
            .update(recruiterPayload)
            .eq("id", existingRec.id);

          if (recErr) {
            logger.error("Error updating recruiter record", recErr);
          }
        } else {
          const { error: recErr } = await supabase
            .schema("organization")
            .from("recruiters")
            .insert(recruiterPayload);

          if (recErr) {
            logger.error("Error creating recruiter record", recErr);
          }
        }
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("smarthire_recruiter_profile_updated"));
      }

      setIsFirstTime(false);
      setSuccessMsg("✅ Recruiter Profile & Company Workspace Specs saved successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile settings.";
      setErrorMsg(msg);
    } finally {
      setSavingCompany(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Avatar file size must be under 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      if (evt.target?.result) {
        const rawDataUrl = evt.target.result as string;
        // Compress avatar image via canvas to lightweight 250x250px thumbnail
        const compressed = await compressImage(rawDataUrl, 250, 250, 0.85);
        setRecruiterAvatar(compressed);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
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

  const initials = `${recruiterFirstName.slice(0, 1)}${recruiterLastName.slice(0, 1)}`.toUpperCase() || "R";

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 sh-animate-in pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Settings2 className="h-3.5 w-3.5" />
              Recruiter Console
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 mt-2">Recruiter Profile & Workspace</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage your personal recruiter profile specifications and employer company workspace credentials.
          </p>
        </div>

        <Link href="/recruiter/jobs">
          <Button variant="outline" className="text-xs font-bold gap-2 rounded-xl border-zinc-300">
            View Job Directory
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {isFirstTime && !successMsg && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg space-y-2">
          <div className="flex items-center gap-2 font-black text-base">
            <Sparkles className="h-5 w-5 text-amber-300" />
            Complete Your Recruiter & Employer Profile First
          </div>
          <p className="text-xs text-blue-100 leading-relaxed">
            Welcome to SmartHire! As a hiring manager or recruiter, please fill out your personal profile and company details below. These specs will be attached to your job openings, candidate evaluations, and generated offer letters.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleUpdateCompany} className="space-y-8">
        {/* Section 1: Personal Recruiter Details */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900">Recruiter Personal Profile & Specifications</h2>
              <p className="text-xs text-zinc-500">
                Your personal details are automatically attached as the hiring lead when publishing jobs and generating candidate offer letters.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative group shrink-0">
              {recruiterAvatar ? (
                <img
                  src={recruiterAvatar}
                  alt="Recruiter Photo"
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-blue-500 shadow-md"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-zinc-900 text-white font-black text-xl flex items-center justify-center border-2 border-zinc-700 shadow-md">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                title="Upload Photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-800 block">
                Recruiter Avatar Photo <span className="text-red-500 font-extrabold">* (Required)</span>
              </span>
              <p className="text-xs text-zinc-500">
                Rendered on job specifications lobby cards and candidate interview panels.
              </p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 mt-1 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Recruiter Photo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">First Name *</label>
              <input
                type="text"
                required
                value={recruiterFirstName}
                onChange={(e) => setRecruiterFirstName(e.target.value)}
                placeholder="e.g. Mir"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Last Name *</label>
              <input
                type="text"
                required
                value={recruiterLastName}
                onChange={(e) => setRecruiterLastName(e.target.value)}
                placeholder="e.g. Suhaib"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-zinc-700 block">Professional Recruiter Title / Designation *</label>
              <input
                type="text"
                required
                value={recruiterTitle}
                onChange={(e) => setRecruiterTitle(e.target.value)}
                placeholder="e.g. Senior Talent Acquisition Manager"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Contact Email</label>
              <input
                type="email"
                disabled
                value={recruiterEmail}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2.5 text-xs font-bold text-zinc-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Phone Number</label>
              <input
                type="text"
                value={recruiterPhone}
                onChange={(e) => setRecruiterPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Company & Employer Workspace Details */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900">Company & Employer Workspace Specifications</h2>
              <p className="text-xs text-zinc-500">
                These details represent the actual employer enterprise hosting the job openings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-zinc-700 block">Company Name *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Innovations Corp"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Domain / Website</label>
              <input
                type="text"
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                placeholder="e.g. acme.com"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Industry Field</label>
              <input
                type="text"
                value={companyIndustry}
                onChange={(e) => setCompanyIndustry(e.target.value)}
                placeholder="e.g. Software & Artificial Intelligence"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Company Location / HQ</label>
              <input
                type="text"
                value={companyLocation}
                onChange={(e) => setCompanyLocation(e.target.value)}
                placeholder="e.g. Srinagar, Kashmir / Remote"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 block">Company Size</label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none bg-white"
              >
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="500+">500+ employees</option>
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-zinc-700 block">Company Overview / Bio Summary</label>
              <textarea
                rows={3}
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                placeholder="Describe your company culture, technology stack, and hiring mission..."
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-medium text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={savingCompany}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md cursor-pointer flex items-center gap-2"
          >
            {savingCompany ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Specs...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                Save Recruiter & Company Specs
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
