/**
 * Dedicated layout for the Coding Exam IDE route.
 * This overrides the parent candidate layout to remove sidebar/header,
 * giving the IDE the entire viewport for a focused exam experience.
 */
export default function CodingExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-dvw overflow-hidden bg-zinc-950">
      {children}
    </div>
  );
}

import * as React from "react";
