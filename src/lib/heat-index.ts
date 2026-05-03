// NWS Rothfusz heat-index formula. Inputs/outputs in Celsius for storage;
// the formula itself is defined in Fahrenheit, so we convert in/out.
//
// References:
//   https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
//   https://en.wikipedia.org/wiki/Heat_index
//
// The formula is only meaningful when temperature ≥ 80 °F (≈26.7 °C);
// below that we return the actual air temperature (the heat index can't be
// lower than the temperature itself).

export type HeatDangerLevel =
  | "safe"
  | "caution"
  | "extreme_caution"
  | "danger"
  | "extreme_danger";

const cToF = (c: number) => c * (9 / 5) + 32;
const fToC = (f: number) => (f - 32) * (5 / 9);

export function computeHeatIndexCelsius(
  temperatureC: number,
  humidityPct: number,
): number {
  const t = cToF(temperatureC);
  const r = humidityPct;

  if (t < 80) {
    return temperatureC;
  }

  // Simplified Steadman regression (used by NWS as initial estimate)
  const simple =
    0.5 *
    (t + 61.0 + (t - 68.0) * 1.2 + r * 0.094);

  // Average it with the actual temp to decide whether to escalate
  if ((simple + t) / 2 < 80) {
    return fToC(simple);
  }

  // Full Rothfusz regression (no adjustment terms applied for simplicity —
  // adjustments only apply at extreme RH ranges that rarely occur in PH)
  let hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * r -
    0.22475541 * t * r -
    0.00683783 * t * t -
    0.05481717 * r * r +
    0.00122874 * t * t * r +
    0.00085282 * t * r * r -
    0.00000199 * t * t * r * r;

  // Low-humidity adjustment
  if (r < 13 && t >= 80 && t <= 112) {
    const adj = ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    hi -= adj;
  }
  // High-humidity adjustment
  if (r > 85 && t >= 80 && t <= 87) {
    const adj = ((r - 85) / 10) * ((87 - t) / 5);
    hi += adj;
  }

  return fToC(hi);
}

// Classify a heat index in °C against NWS bands. Source thresholds (°F)
// converted: 80 (26.7), 90 (32.2), 103 (39.4), 124 (51.1).
// We use 32/41/54 °C as round operational thresholds — same band semantics.
export function classifyHeatDanger(heatIndexC: number): HeatDangerLevel {
  if (heatIndexC >= 54) return "extreme_danger";
  if (heatIndexC >= 41) return "danger";
  if (heatIndexC >= 32) return "extreme_caution";
  if (heatIndexC >= 27) return "caution";
  return "safe";
}

// Game suspension is recommended at "danger" and required at "extreme_danger".
// Per kickoff doc, this is a flag only — actual suspension authority sits with
// command_center, who can override the recommendation.
export function shouldSuspendGames(level: HeatDangerLevel): boolean {
  return level === "danger" || level === "extreme_danger";
}

export const HEAT_DANGER_LABELS: Record<HeatDangerLevel, string> = {
  safe: "Safe",
  caution: "Caution",
  extreme_caution: "Extreme caution",
  danger: "Danger",
  extreme_danger: "Extreme danger",
};

export const HEAT_DANGER_BADGE: Record<HeatDangerLevel, string> = {
  safe: "bg-gray-100 text-gray-800",
  caution: "bg-yellow-100 text-yellow-800",
  extreme_caution: "bg-orange-100 text-orange-800",
  danger: "bg-red-100 text-red-800",
  extreme_danger: "bg-red-200 text-red-900 ring-1 ring-red-500/40",
};
