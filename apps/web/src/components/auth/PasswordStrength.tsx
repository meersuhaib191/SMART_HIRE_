"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password?: string;
}

export function PasswordStrength({ password = "" }: PasswordStrengthProps) {
  const requirements = [
    { label: "At least 8 characters", val: password.length >= 8 },
    { label: "Contains a number", val: /\d/.test(password) },
    { label: "Contains a special symbol", val: /[^A-Za-z0-9]/.test(password) },
    { label: "Contains uppercase character", val: /[A-Z]/.test(password) },
  ];

  const score = requirements.filter((r) => r.val).length;

  const strengthColor = () => {
    if (score <= 1) return "bg-red-500";
    if (score <= 3) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const strengthLabel = () => {
    if (password.length === 0) return "Empty";
    if (score <= 1) return "Weak";
    if (score <= 3) return "Medium";
    return "Strong";
  };

  return (
    <div className="space-y-3 w-full text-left pt-1">
      {/* Visual meter bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-600 font-medium">Password Strength:</span>
          <span
            className={`font-semibold ${
              score <= 1
                ? "text-red-600"
                : score <= 3
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          >
            {strengthLabel()}
          </span>
        </div>
        <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strengthColor()}`}
            style={{ width: `${password.length === 0 ? 0 : (score / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Grid of checklist requirements */}
      <div className="grid grid-cols-2 gap-2">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
            {req.val ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            )}
            <span className={req.val ? "text-zinc-800 font-semibold" : "text-zinc-500"}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
