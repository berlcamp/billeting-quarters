"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { manilaDateLabel } from "@/lib/timezone";

interface Props {
  date: string; // YYYY-MM-DD
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map((s) => Number(s));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function DayPicker({ date }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function navigateTo(next: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("date", next);
    router.push(`?${sp.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Previous day"
        onClick={() => navigateTo(shiftDate(date, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex flex-col items-center">
        <Input
          type="date"
          value={date}
          onChange={(e) => navigateTo(e.target.value)}
          className="h-8 w-44 text-center font-mono text-xs"
        />
        <span className="mt-1 text-xs text-muted-foreground">
          {manilaDateLabel(date)}
        </span>
      </div>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Next day"
        onClick={() => navigateTo(shiftDate(date, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
