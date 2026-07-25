"use client";

import { useState, useEffect } from "react";
import { User } from "@smarthire/types";
import { createClient } from "@/utils/supabase/client";
import { authService, SignUpParams, UserRole } from "@/services/auth";

let browserClient: ReturnType<typeof createClient> | null = null;

function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    return createClient();
  }
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchUserWithDetails = async (sessionUser: any): Promise<User | null> => {
      if (!sessionUser) return null;

      const meta = sessionUser.user_metadata || {};
      let firstName = meta.first_name || meta.firstName || "";
      let lastName = meta.last_name || meta.lastName || "";
      let role = (meta.role as UserRole) || "candidate";
      let avatarUrl = meta.avatar_url || "";
      let profileCompleted = false;

      // Special check: If user email contains admin or metadata role is admin/platform-admin
      if (sessionUser.email && sessionUser.email.toLowerCase().includes("admin") && (role === "candidate" || !role)) {
        role = "platform-admin";
      }

      // 1. Primary check: Query organization.recruiters database table for recruiter profile
      try {
        const { data: recData } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("first_name, last_name, avatar_url, role, profile_completed")
          .eq("user_id", sessionUser.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (recData) {
          if (role !== "platform-admin" && role !== "admin" && role !== "company-admin") {
            role = (recData.role as UserRole) || "recruiter";
          }
          if (recData.first_name) firstName = recData.first_name;
          if (recData.last_name) lastName = recData.last_name;
          if (recData.avatar_url) avatarUrl = recData.avatar_url;
          if (recData.profile_completed) profileCompleted = true;
        }
      } catch {
        // Ignore DB query errors gracefully
      }

      // 2. Secondary check: Query identity.users database table
      try {
        const { data: dbUser } = await supabase
          .schema("identity")
          .from("users")
          .select("first_name, last_name, role")
          .eq("id", sessionUser.id)
          .maybeSingle();

        if (dbUser) {
          if (dbUser.first_name && !firstName) firstName = dbUser.first_name;
          if (dbUser.last_name && !lastName) lastName = dbUser.last_name;
          if (dbUser.role && role !== "platform-admin" && role !== "admin") role = dbUser.role as UserRole;
        }
      } catch {
        // Ignore DB query errors gracefully
      }

      // Check local recruiter profile specs fallback
      if (typeof window !== "undefined" && !avatarUrl) {
        try {
          const savedKey = `smarthire_active_recruiter_profile_${sessionUser.id}`;
          const raw = localStorage.getItem(savedKey) || localStorage.getItem("smarthire_active_recruiter_profile");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.recruiterFirstName && !firstName) firstName = parsed.recruiterFirstName;
            if (parsed.recruiterLastName && !lastName) lastName = parsed.recruiterLastName;
            if (parsed.recruiterAvatar) avatarUrl = parsed.recruiterAvatar;
            if (role !== "admin" && role !== "platform-admin" && role !== "company-admin") role = "recruiter";
          }
        } catch {
          // Ignore storage errors
        }
      }

      // If first name is still empty, derive clean name from email
      if (!firstName && sessionUser.email) {
        const namePart = sessionUser.email.split("@")[0] || "User";
        const parts = namePart.split(/[\._\-]/);
        firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "User";
        lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "";
      }

      return {
        id: sessionUser.id,
        email: sessionUser.email || "",
        firstName: firstName || "User",
        lastName: lastName || "",
        role: role || "candidate",
        createdAt: sessionUser.created_at,
        avatarUrl,
        profileCompleted,
      } as any;
    };

    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        if (session?.user) {
          const detailedUser = await fetchUserWithDetails(session.user);
          if (active) setUser(detailedUser);
        } else {
          if (active) setUser(null);
        }
      } catch (error) {
        console.error("Failed to load auth session", error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadSession();

    const handleProfileUpdate = () => {
      loadSession();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("smarthire_recruiter_profile_updated", handleProfileUpdate);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      if (session?.user) {
        const detailedUser = await fetchUserWithDetails(session.user);
        if (active) setUser(detailedUser);
      } else {
        if (active) setUser(null);
      }
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("smarthire_recruiter_profile_updated", handleProfileUpdate);
      }
    };
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    register: async (params: SignUpParams) => {
      return await authService.signUp(params);
    },
    login: async (email: string, password: string) => {
      return await authService.signIn(email, password);
    },
    logout: async () => {
      return await authService.signOut();
    },
    forgotPassword: async (email: string) => {
      return await authService.forgotPassword(email);
    },
    resetPassword: async (password: string) => {
      return await authService.resetPassword(password);
    },
  };
}
