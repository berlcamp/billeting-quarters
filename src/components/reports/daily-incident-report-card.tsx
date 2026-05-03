"use client";

import { useState, useTransition } from "react";
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
  defaultDate: string; // YYYY-MM-DD in Asia/Manila
}

export function DailyIncidentReportCard({ defaultDate }: Props) {
  const [date, setDate] = useState(defaultDate);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    startTransition(() => {
      router.push(`/dashboard/reports/daily-incident/${date}`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Daily Incident Summary
        </CardTitle>
        <CardDescription>
          Counts by category, severity, and status for any operating day
          (Asia/Manila). Print directly from the report page for a PDF export.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="report-date">Date</Label>
            <Input
              id="report-date"
              type="date"
              value={date}
              max={defaultDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
          >
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
