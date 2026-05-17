"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";

interface Props {
  selectedDate: string;
  min: string;
  max: string;
}

export function HeadCounterDateNav({ selectedDate, min, max }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next && next !== selectedDate) sp.set("date", next);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      Date
      <Input
        type="date"
        value={selectedDate}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value || selectedDate)}
        className="h-9 w-[180px]"
      />
    </label>
  );
}
