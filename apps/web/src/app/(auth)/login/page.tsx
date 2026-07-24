"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail } from "lucide-react";
import { AuthCard, FormField, PasswordInput, OAuthButton, SubmitButton } from "@/components/auth";
import { authService } from "@/services/auth";
import { logger } from "@smarthire/logger";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginFormContent() {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirectTo");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  React.useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("smarthire_remembered_email");
      const isRemembered = localStorage.getItem("smarthire_remember_me") === "true";
      if (savedEmail && isRemembered) {
        setValue("email", savedEmail);
        setValue("rememberMe", true);
      }
    } catch {
      // Ignore SSR/storage error
    }
  }, [setValue]);

  const onSubmit = async (values: LoginFormValues) => {
    logger.info(`[LoginPage] Submit credentials for: ${values.email}`);
    setLoading(true);
    setErrorMsg(null);

    try {
      if (values.rememberMe) {
        localStorage.setItem("smarthire_remembered_email", values.email);
        localStorage.setItem("smarthire_remember_me", "true");
      } else {
        localStorage.removeItem("smarthire_remembered_email");
        localStorage.removeItem("smarthire_remember_me");
      }

      // 1. Sign in with browser client to set document.cookie synchronously
      const supabase = createClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signInError) {
        throw new Error(signInError.message || "Invalid credentials. Please try again.");
      }

      // 2. Sync server route handler
      await authService.signIn(values.email, values.password).catch(() => {});

      const user = signInData?.user;
      logger.info("[LoginPage] Sign in successful", user?.id);
      
      const role = user?.user_metadata?.role || "candidate";
      let redirectPath = redirectTo || "/candidate/dashboard";
      if (!redirectTo) {
        if (role === "platform-admin") {
          redirectPath = "/admin/system";
        } else if (role === "recruiter" || role === "company-admin") {
          const savedProfileKey = `smarthire_active_recruiter_profile_${user?.id}`;
          const savedProfile = localStorage.getItem(savedProfileKey) || localStorage.getItem("smarthire_active_recruiter_profile");
          if (!savedProfile) {
            redirectPath = "/recruiter/profile";
          } else {
            redirectPath = "/recruiter/jobs";
          }
        }
      }
      
      window.location.href = redirectPath;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
      setErrorMsg(message);
      logger.error("[LoginPage] Sign in failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "microsoft") => {
    logger.info(`[LoginPage] Trigger social SSO for: ${provider}`);
  };

  return (
    <AuthCard
      title="Sign in to Smart Hire"
      subtitle={
        <span>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            Sign up
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-600 animate-in fade-in zoom-in-95">
            {errorMsg}
          </div>
        )}

        <FormField
          label="Email Address"
          id="email"
          type="email"
          icon={Mail}
          placeholder="name@company.com"
          error={errors.email?.message}
          disabled={loading}
          {...register("email")}
        />

        <div className="space-y-2">
          <PasswordInput
            label="Password"
            id="password"
            placeholder="••••••••"
            error={errors.password?.message}
            disabled={loading}
            {...register("password")}
          />
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={loading}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                {...register("rememberMe")}
              />
              <span>Remember me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <SubmitButton loading={loading}>Sign In</SubmitButton>

        {/* Separator */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-x-0 h-px bg-zinc-200" />
          <span className="relative px-3 text-[10px] text-zinc-500 bg-white font-bold uppercase tracking-wider">
            Or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <OAuthButton provider="google" onClick={() => handleSocialLogin("google")} disabled={loading} />
          <OAuthButton provider="microsoft" onClick={() => handleSocialLogin("microsoft")} disabled={loading} />
        </div>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm font-semibold text-zinc-600">Loading sign in...</div>}>
      <LoginFormContent />
    </React.Suspense>
  );
}
