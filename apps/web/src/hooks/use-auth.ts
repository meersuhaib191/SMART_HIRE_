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

      // Check local recruiter profile specs if stored for this user
      if (typeof window !== "undefined") {
        try {
          const savedKey = `smarthire_active_recruiter_profile_${sessionUser.id}`;
          const raw = localStorage.getItem(savedKey) || localStorage.getItem("smarthire_active_recruiter_profile");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.recruiterFirstName) firstName = parsed.recruiterFirstName;
            if (parsed.recruiterLastName) lastName = parsed.recruiterLastName;
            role = "recruiter";
          }
        } catch {
          // Ignore storage errors
        }
      }

      // Try database identity table lookup as secondary enrichment
      try {
        const { data: dbUser } = await supabase
          .schema("identity")
          .from("users")
          .select("first_name, last_name, role")
          .eq("id", sessionUser.id)
          .maybeSingle();

        if (dbUser) {
          if (dbUser.first_name) firstName = dbUser.first_name;
          if (dbUser.last_name) lastName = dbUser.last_name;
          if (dbUser.role) role = dbUser.role as UserRole;
        }
      } catch {
        // Ignore DB query errors gracefully
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
      };
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
