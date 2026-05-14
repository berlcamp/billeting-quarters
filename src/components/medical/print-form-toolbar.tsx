"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

interface Props {
  backHref: string;
  /** When true, fires window.print() once on mount. */
  autoPrint?: boolean;
}

export function PrintFormToolbar({ backHref, autoPrint = false }: Props) {
  const hasAutoPrinted = useRef(false);

  useEffect(() => {
    if (!autoPrint || hasAutoPrinted.current) return;
    hasAutoPrinted.current = true;
    // Defer one tick so layout settles (esp. the banner image) before the
    // print dialog snapshots the page.
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  return (
    <div className="flex items-center justify-between gap-3 print:hidden">
      <Link
        href={backHref}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <Button type="button" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print
      </Button>
    </div>
  );
}
