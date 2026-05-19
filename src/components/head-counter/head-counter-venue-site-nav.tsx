"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SiteOption {
  id: string;
  name: string;
}

interface Props {
  selectedId: string;
  sites: SiteOption[];
  allValue: string;
}

export function HeadCounterVenueSiteNav({
  selectedId,
  sites,
  allValue,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string | null) {
    const sp = new URLSearchParams(params.toString());
    sp.set("site", next ?? allValue);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      Playing venue
      <Select value={selectedId} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[280px]">
          <SelectValue>
            {(v: string | null) => {
              if (!v || v === allValue) return "All venues";
              const s = sites.find((ss) => ss.id === v);
              return s ? s.name : v;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>All venues</SelectItem>
          {sites.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
