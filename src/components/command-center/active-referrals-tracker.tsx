"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ACTIVE_REFERRAL_STATUSES } from "@/lib/labels";
import type { Database } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

interface ActiveReferralsTrackerProps {
  referrals: Referral[];
  siteLookup: Map<string, string>;
  // When false, rows render as static cards instead of links — keeps the
  // tracker visible to everyone while gating navigation by permission.
  canOpen?: boolean;
}

const STAGE_LABEL: Record<Referral["level"], string> = {
  field_to_ucf: "At UCF",
  ucf_to_hospital: "At Hospital",
  hospital_admit: "Direct admit",
  ucf_admit: "Direct admit",
};

const DETAIL_PATH: Record<Referral["level"], string> = {
  field_to_ucf: "/dashboard/medical/ucf",
  ucf_to_hospital: "/dashboard/medical/hospital",
  hospital_admit: "/dashboard/medical/hospital",
  ucf_admit: "/dashboard/medical/ucf",
};

export function ActiveReferralsTracker({
  referrals,
  siteLookup,
  canOpen = true,
}: ActiveReferralsTrackerProps) {
  const active = referrals
    .filter((r) =>
      (ACTIVE_REFERRAL_STATUSES as readonly string[]).includes(r.status),
    )
    .sort((a, b) => a.referred_at.localeCompare(b.referred_at));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">
          Active referrals ({active.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {active.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No referrals in flight.
          </div>
        ) : (
          <ul className="divide-y max-h-[480px] overflow-y-auto">
            {active.map((r) => {
              const body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {r.patient_name}
                    </span>
                    <StatusBadge variant="referral" status={r.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono text-[10px]">
                      {r.referral_number}
                    </span>
                    <span>·</span>
                    <span>{STAGE_LABEL[r.level]}</span>
                    {siteLookup.get(r.to_site_id) ? (
                      <>
                        <span>·</span>
                        <span className="truncate">
                          {siteLookup.get(r.to_site_id)}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(r.referred_at), {
                      addSuffix: true,
                    })}
                  </div>
                </>
              );
              return (
                <li key={r.id}>
                  {canOpen ? (
                    <Link
                      href={`${DETAIL_PATH[r.level]}/${r.id}`}
                      className="flex flex-col gap-1 px-4 py-3 hover:bg-accent/40 transition-colors"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-1 px-4 py-3">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
