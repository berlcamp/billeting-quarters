"use client";

import { useState } from "react";
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
import { PipelineView } from "./pipeline-view";
import { LiveIncidentFeed } from "./live-incident-feed";
import { ActiveReferralsTracker } from "./active-referrals-tracker";
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
}

export function CommandCenterOverview({
  initialIncidents,
  initialReferrals,
  sites,
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

  return (
    <div className="space-y-6">
      <StatCards incidents={incidents} referrals={referrals} />
      <PipelineView incidents={incidents} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveIncidentFeed incidents={incidents} siteLookup={siteLookup} />
        </div>
        <div>
          <ActiveReferralsTracker
            referrals={referrals}
            siteLookup={siteLookup}
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
