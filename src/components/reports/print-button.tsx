"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PrintButton({ children }: { children: ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
    >
      {children}
    </Button>
  );
}
