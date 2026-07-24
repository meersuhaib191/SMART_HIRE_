"use client";

import * as React from "react";
import { Loader2, ArrowRight } from "lucide-react";

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export function SubmitButton({ loading, children, className, ...props }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      className={`w-full justify-center bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs h-11 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-[0.99] disabled:opacity-50 ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      ) : (
        <>
          <span>{children}</span>
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
