"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registration?: any;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, className = "", id, registration, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const inputProps = registration ? { ...registration, ...props } : props;
    
    // Combine forwarded ref and react-hook-form registration ref safely
    const combinedRef = (e: HTMLInputElement | null) => {
      if (typeof ref === "function") {
        ref(e);
      } else if (ref && "current" in ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = e;
      }
      if (registration && typeof registration.ref === "function") {
        registration.ref(e);
      }
    };

    return (
      <div className="space-y-1.5 w-full text-left relative">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-bold text-zinc-700 uppercase tracking-wider block"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <Lock className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            ref={combinedRef}
            id={id}
            type={showPassword ? "text" : "password"}
            className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 bg-white focus:outline-none transition-all duration-200 ${
              error
                ? "border-red-500 bg-red-50 focus:border-red-500"
                : "border-zinc-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            } ${className}`}
            {...inputProps}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && (
          <p className="text-[11px] font-semibold text-red-600 animate-in fade-in slide-in-from-top-1 duration-150">
            {error}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
