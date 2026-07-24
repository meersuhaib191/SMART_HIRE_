import * as React from "react";
import { LucideIcon } from "lucide-react";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: LucideIcon;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, className = "", id, icon: Icon, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full text-left">
        <label
          htmlFor={id}
          className="text-xs font-bold text-zinc-700 uppercase tracking-wider block"
        >
          {label}
        </label>
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={`w-full rounded-xl border ${Icon ? "pl-10" : "pl-3.5"} pr-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 bg-white focus:outline-none transition-all duration-200 ${
              error
                ? "border-red-500 bg-red-50 focus:border-red-500"
                : "border-zinc-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            } ${className}`}
            {...props}
          />
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

FormField.displayName = "FormField";
