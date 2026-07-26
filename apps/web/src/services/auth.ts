import { createClient } from "@/utils/supabase/client";
import { logger } from "@smarthire/logger";

export type UserRole = "candidate" | "recruiter" | "company-admin" | "platform-admin";

export interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export const authService = {
  /**
   * Register a new user with role metadata via server API route handler
   */
  signUp: async ({ email, password, firstName, lastName, role }: SignUpParams) => {
    logger.info(`Signing up user: ${email} with role: ${role}`);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, firstName, lastName, role }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      logger.error("[authService] SignUp failed", json.error);
      throw new Error(json.error || "Sign up failed");
    }
    return json;
  },

  /**
   * Authenticate a user with email and password via server API route handler
   */
  signIn: async (email: string, password: string) => {
    logger.info(`Signing in user: ${email}`);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      logger.error("[authService] SignIn failed", json.error);
      throw new Error(json.error || "Invalid credentials");
    }
    return json;
  },

  /**
   * Log out current user session via server-side API route
   */
  signOut: async () => {
    logger.info("Signing out current session");
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("smarthire_active_recruiter_profile");
        localStorage.removeItem("smarthire_onboarding_company_info");
        localStorage.removeItem("smarthire_onboarding_company_id");
      } catch {
        // Ignore storage errors on signout
      }
    }
    const res = await fetch("/api/auth/logout", {
      method: "POST",
    });
    if (!res.ok) {
      const json = await res.json();
      logger.error("Sign out failed", json.error);
      throw new Error(json.error || "Sign out failed");
    }
    window.location.href = "/login";
  },

  /**
   * Forgot Password - send reset token link to email
   */
  forgotPassword: async (email: string) => {
    const supabase = createClient();
    logger.info(`Sending password reset link to: ${email}`);
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      logger.error("Forgot password request failed", error);
      throw error;
    }
    return data;
  },

  /**
   * Reset Password - update user credentials
   */
  resetPassword: async (password: string) => {
    const supabase = createClient();
    logger.info("Updating user password credentials");
    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      logger.error("Password reset update failed", error);
      throw error;
    }
    return data;
  },

  /**
   * Query the current session and user
   */
  getSession: async () => {
    const supabase = createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      logger.error("Get session failed", error);
      throw error;
    }
    return session;
  },
};
