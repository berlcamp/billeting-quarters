"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DelegationOption {
  id: string;
  region_code: string;
  region_name: string;
}

interface Props {
  selectedId: string;
  delegations: DelegationOption[];
  allValue: string;
}

export function HeadCounterDelegationNav({
  selectedId,
  delegations,
  allValue,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string | null) {
    const sp = new URLSearchParams(params.toString());
    sp.set("delegation", next ?? allValue);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      Delegation
      <Select value={selectedId} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[260px]">
          <SelectValue>
            {(v: string | null) => {
              if (!v || v === allValue) return "All delegations";
              const d = delegations.find((dd) => dd.id === v);
              return d ? `${d.region_code} — ${d.region_name}` : v;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>All delegations</SelectItem>
          {delegations.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.region_code} — {d.region_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
