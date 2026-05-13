"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertOctagon, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRealtimeIncidents } from "@/lib/hooks/use-realtime-incidents";
import { useRealtimeReferrals } from "@/lib/hooks/use-realtime-referrals";
import { StatCards } from "./stat-cards";
import { IncidentsByCategoryCard } from "./incidents-by-category";
import { PipelineView } from "./pipeline-view";
import { LiveIncidentFeed } from "./live-incident-feed";
import { ActiveReferralsTracker } from "./active-referrals-tracker";
import { INCIDENT_CATEGORIES, type IncidentCategory } from "@/lib/labels";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];
type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];
type Site = Database["palaro"]["Tables"]["sites"]["Row"];

// Leaflet uses `window` at module init — load only on the client.
const SitesMap = dynamic(
  () => import("./sites-map").then((m) => m.SitesMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-md border bg-muted/20 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

interface CommandCenterOverviewProps {
  initialIncidents: Incident[];
  initialReferrals: Referral[];
  sites: Site[];
  // When false, the corresponding feed renders rows as plain (non-clickable)
  // items so users without the permission can still see the data but cannot
  // navigate into a detail view they wouldn't be allowed to load.
  canOpenIncidents: boolean;
  canOpenReferrals: boolean;
}

export function CommandCenterOverview({
  initialIncidents,
  initialReferrals,
  sites,
  canOpenIncidents,
  canOpenReferrals,
}: CommandCenterOverviewProps) {
  const [mapOpen, setMapOpen] = useState(true);
  useRealtimeIncidents({
    onCritical: (incident) => {
      toast.error(`CRITICAL: ${incident.title}`, {
        description: `Incident #${incident.incident_number} just opened.`,
        icon: <AlertOctagon className="size-4" />,
        duration: 10_000,
      });
    },
  });
  const referrals = useRealtimeReferrals(initialReferrals);
  const incidents = initialIncidents;
  const siteLookup = new Map(sites.map((s) => [s.id, s.name]));

  const incidentsByCategory = useMemo(() => {
    const base: Record<IncidentCategory, number> = {
      medical: 0,
      utility: 0,
      vip_status: 0,
      security: 0,
      facility: 0,
      other: 0,
    };
    for (const i of incidents) {
      if (INCIDENT_CATEGORIES.includes(i.category)) {
        base[i.category]++;
      }
    }
    return base;
  }, [incidents]);

  return (
    <div className="space-y-6">
      <StatCards incidents={incidents} referrals={referrals} />
      <IncidentsByCategoryCard byCategory={incidentsByCategory} />
      <PipelineView incidents={incidents} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveIncidentFeed
            incidents={incidents}
            siteLookup={siteLookup}
            canOpen={canOpenIncidents}
          />
        </div>
        <div>
          <ActiveReferralsTracker
            referrals={referrals}
            siteLookup={siteLookup}
            canOpen={canOpenReferrals}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base inline-flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            Sites map
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMapOpen((o) => !o)}
            aria-expanded={mapOpen}
          >
            {mapOpen ? (
              <>
                Hide
                <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                Show
                <ChevronDown className="size-4" />
              </>
            )}
          </Button>
        </CardHeader>
        {mapOpen ? (
          <CardContent>
            <SitesMap sites={sites} incidents={incidents} />
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
