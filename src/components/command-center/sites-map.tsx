"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import L, { type LatLngExpression } from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  SITE_TYPE_LABELS,
  SITE_TYPE_SHORT,
  type SiteType,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Site = Database["palaro"]["Tables"]["sites"]["Row"];
type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];
type IncidentSeverity = Database["palaro"]["Enums"]["incident_severity"];

interface SitesMapProps {
  sites: Site[];
  incidents: Incident[];
  // When false, the incident popup omits the "Open incident →" link so users
  // without `incident.view` can still see the marker but cannot navigate.
  canOpenIncidents?: boolean;
}

const SITE_COLOR: Record<SiteType, string> = {
  billeting_quarter: "#16a34a", // green
  playing_venue: "#2563eb", // blue
  urgent_care_facility: "#ea580c", // orange
  hospital: "#dc2626", // red
  command_center: "#7c3aed", // violet
  clinic: "#0d9488", // teal
};

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  low: "#9ca3af",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

// Default to roughly the center of the Philippines if there are no coordinates yet.
const PH_CENTER: LatLngExpression = [12.8797, 121.774];
const PH_ZOOM = 6;

function siteIcon(type: SiteType) {
  const color = SITE_COLOR[type];
  return L.divIcon({
    className: "ppdms-site-marker",
    html: `<div style="
      width: 18px; height: 18px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function incidentIcon(severity: IncidentSeverity) {
  const color = SEVERITY_COLOR[severity];
  return L.divIcon({
    className: "ppdms-incident-marker",
    html: `<div style="
      width: 14px; height: 14px;
      transform: rotate(45deg);
      background: ${color};
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function FitToBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export function SitesMap({
  sites,
  incidents,
  canOpenIncidents = true,
}: SitesMapProps) {
  const sitesWithCoords = useMemo(
    () =>
      sites.filter(
        (s): s is Site & { latitude: number; longitude: number } =>
          s.is_active && s.latitude != null && s.longitude != null,
      ),
    [sites],
  );

  // Index sites by id so we can resolve incident coords from site_id when the
  // incident itself doesn't carry lat/lng.
  const siteById = useMemo(() => {
    const m = new Map<string, Site>();
    for (const s of sites) m.set(s.id, s);
    return m;
  }, [sites]);

  const visibleIncidents = useMemo(() => {
    return incidents
      .filter((i) => i.status !== "resolved" && i.status !== "closed")
      .map((i) => {
        let lat = i.latitude;
        let lng = i.longitude;
        if ((lat == null || lng == null) && i.site_id) {
          const site = siteById.get(i.site_id);
          if (site?.latitude != null && site?.longitude != null) {
            lat = site.latitude;
            lng = site.longitude;
          }
        }
        return lat != null && lng != null
          ? { incident: i, lat, lng }
          : null;
      })
      .filter(
        (x): x is { incident: Incident; lat: number; lng: number } => x !== null,
      );
  }, [incidents, siteById]);

  const allPoints: LatLngExpression[] = [
    ...sitesWithCoords.map(
      (s) => [s.latitude, s.longitude] as LatLngExpression,
    ),
    ...visibleIncidents.map(
      (i) => [i.lat, i.lng] as LatLngExpression,
    ),
  ];

  if (allPoints.length === 0) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
        No sites with coordinates yet — set lat/lng on a site in Admin → Sites
        to populate the map.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <MapContainer
        center={PH_CENTER}
        zoom={PH_ZOOM}
        scrollWheelZoom={false}
        className="h-[560px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sitesWithCoords.map((s) => (
          <Marker
            key={`site-${s.id}`}
            position={[s.latitude, s.longitude]}
            icon={siteIcon(s.site_type)}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {SITE_TYPE_LABELS[s.site_type]}
                </div>
                {s.address ? (
                  <div className="text-xs text-muted-foreground">
                    {s.address}
                  </div>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}

        {visibleIncidents.map(({ incident, lat, lng }) => (
          <Marker
            key={`incident-${incident.id}`}
            position={[lat, lng]}
            icon={incidentIcon(incident.severity)}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <div className="font-medium">{incident.title}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  {incident.incident_number}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {incident.severity} · {incident.status.replace("_", " ")}
                </div>
                {canOpenIncidents ? (
                  <Link
                    href={`/dashboard/incidents/${incident.id}`}
                    className="block text-xs underline-offset-2 hover:underline"
                  >
                    Open incident →
                  </Link>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}

        <FitToBounds points={allPoints} />
      </MapContainer>

      <div className="flex flex-wrap gap-3 border-t bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">Sites:</span>
        {(Object.keys(SITE_COLOR) as SiteType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1">
            <span
              className="size-2.5 rounded-full"
              style={{ background: SITE_COLOR[t] }}
            />
            {SITE_TYPE_SHORT[t]}
          </span>
        ))}
        <span className="font-medium uppercase tracking-wider ml-2">
          Incidents:
        </span>
        {(Object.keys(SEVERITY_COLOR) as IncidentSeverity[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span
              className="size-2.5 rotate-45"
              style={{ background: SEVERITY_COLOR[s] }}
            />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
