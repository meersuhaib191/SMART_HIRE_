"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthCard, FormField, PasswordInput, OAuthButton, SubmitButton } from "@/components/auth";
import { authService } from "@/services/auth";
import { logger } from "@smarthire/logger";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    logger.info(`[LoginPage] Submit credentials for: ${values.email}`);
    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await authService.signIn(values.email, values.password);
      const user = response?.user;
      logger.info("[LoginPage] Sign in successful", user?.id);
      
      const role = user?.user_metadata?.role || "candidate";
      let redirectPath = "/candidate/dashboard";
      if (role === "platform-admin") {
        redirectPath = "/admin/system";
      } else if (role === "recruiter" || role === "company-admin") {
        redirectPath = "/recruiter/jobs";
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
    // SSO Redirects can be added here
  };

  return (
    <AuthCard
      title="Sign in to Smart Hire"
      subtitle={
        <span>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-blue-500 hover:text-blue-450 hover:underline">
            Sign up
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {errorMsg && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-medium text-red-500 animate-in fade-in zoom-in-95">
            {errorMsg}
          </div>
        )}

        <FormField
          label="Email Address"
          id="email"
          type="email"
          placeholder="name@company.com"
          error={errors.email?.message}
          disabled={loading}
          {...register("email")}
        />

        <div className="space-y-1.5">
          <PasswordInput
            label="Password"
            id="password"
            placeholder="••••••••"
            error={errors.password?.message}
            disabled={loading}
            {...register("password")}
          />
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
              <input
                type="checkbox"
                disabled={loading}
                className="rounded border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-blue-600 focus:ring-blue-500"
                {...register("rememberMe")}
              />
              <span>Remember me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-blue-500 hover:text-blue-450 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <SubmitButton loading={loading}>Sign In</SubmitButton>

        {/* Separator */}
        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-x-0 h-px bg-zinc-200 dark:bg-zinc-800/80" />
          <span className="relative px-3 text-xs text-zinc-500 bg-white dark:bg-[#09090c] font-semibold uppercase tracking-wider">
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
