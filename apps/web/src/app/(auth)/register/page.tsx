"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthCard, FormField, PasswordInput, PasswordStrength, OAuthButton, SubmitButton } from "@/components/auth";
import { authService, UserRole } from "@/services/auth";
import { logger } from "@smarthire/logger";

const registerSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/\d/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one symbol"),
  role: z.enum(["candidate", "recruiter"] as const),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "candidate",
    },
  });

  const passwordVal = useWatch({ control, name: "password" });

  const onSubmit = async (values: RegisterFormValues) => {
    logger.info(`[RegisterPage] Registering account: ${values.email}`);
    setLoading(true);
    setErrorMsg(null);

    try {
      await authService.signUp({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role as UserRole,
      });

      logger.info("[RegisterPage] Sign up successful, verify email redirect");
      router.push("/verify-email");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed. Please try again.";
      setErrorMsg(message);
      logger.error("[RegisterPage] Sign up failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "microsoft") => {
    logger.info(`[RegisterPage] Trigger social registration: ${provider}`);
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-600 animate-in fade-in zoom-in-95">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="First Name"
            id="firstName"
            placeholder="Jane"
            error={errors.firstName?.message}
            disabled={loading}
            {...register("firstName")}
          />
          <FormField
            label="Last Name"
            id="lastName"
            placeholder="Doe"
            error={errors.lastName?.message}
            disabled={loading}
            {...register("lastName")}
          />
        </div>

        <FormField
          label="Email Address"
          id="email"
          type="email"
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
          <PasswordStrength password={passwordVal} />
        </div>

        {/* Role Selection */}
        <div className="space-y-1.5 w-full text-left">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
            Account Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-center border border-zinc-300 rounded-xl p-2.5 text-xs font-semibold text-zinc-700 bg-white cursor-pointer hover:border-blue-600 transition-colors [&:has(input:checked)]:border-blue-600 [&:has(input:checked)]:bg-blue-50 [&:has(input:checked)]:text-blue-700">
              <input
                type="radio"
                value="candidate"
                disabled={loading}
                className="sr-only"
                {...register("role")}
              />
              <span>Candidate</span>
            </label>
            <label className="flex items-center justify-center border border-zinc-300 rounded-xl p-2.5 text-xs font-semibold text-zinc-700 bg-white cursor-pointer hover:border-blue-600 transition-colors [&:has(input:checked)]:border-blue-600 [&:has(input:checked)]:bg-blue-50 [&:has(input:checked)]:text-blue-700">
              <input
                type="radio"
                value="recruiter"
                disabled={loading}
                className="sr-only"
                {...register("role")}
              />
              <span>Recruiter</span>
            </label>
          </div>
        </div>

        <div className="pt-2">
          <SubmitButton loading={loading}>Sign Up</SubmitButton>
        </div>

        {/* Separator */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-x-0 h-px bg-zinc-200" />
          <span className="relative px-3 text-[10px] text-zinc-500 bg-white font-bold uppercase tracking-wider">
            Or register with
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
