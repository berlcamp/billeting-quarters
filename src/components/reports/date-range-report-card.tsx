"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  title: ReactNode;
  description: ReactNode;
  defaultFrom: string; // YYYY-MM-DD
  defaultTo: string;
  hrefBase: string; // e.g. /dashboard/reports/medical-chain
}

export function DateRangeReportCard({
  title,
  description,
  defaultFrom,
  defaultTo,
  hrefBase,
}: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
    startTransition(() => {
      router.push(`${hrefBase}/${from}/${to}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="report-from">From</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-to">To</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button type="button" onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            Generate report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
