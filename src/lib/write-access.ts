import { geolocation, ipAddress } from "@vercel/functions";

/** Shown on Log / Join when writes are blocked. Keep About quiet — no rule details here. */
export const WRITE_DENIED_MESSAGE =
  "Looks like you’re outside the allowed network. Switch to office Wi‑Fi (or open this at the office) to log a match.";

export const WRITE_DENIED_MESSAGE_JOIN =
  "Looks like you’re outside the allowed network. Switch to office Wi‑Fi (or open this at the office) to add a player.";

export const WRITE_DENIED_CODE = "WRITE_LOCATION_DENIED";

export type WriteAccessReason = "office" | "geo" | "bypass" | "denied";

export interface WriteAccessResult {
  allowed: boolean;
  reason: WriteAccessReason;
}

const EARTH_RADIUS_MILES = 3958.7613;

/** Great-circle distance in miles (Haversine). */
export function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

function parseAllowedIps(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function bypassEnabled(): boolean {
  const v = process.env.WRITE_ACCESS_BYPASS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function geoConfigured(): {
  lat: number;
  lon: number;
  radiusMiles: number;
} | null {
  const lat = parseNumber(process.env.WRITE_GEO_CENTER_LAT);
  const lon = parseNumber(process.env.WRITE_GEO_CENTER_LON);
  const radiusMiles = parseNumber(process.env.WRITE_GEO_RADIUS_MILES);
  if (lat === null || lon === null || radiusMiles === null) return null;
  if (radiusMiles <= 0) return null;
  return { lat, lon, radiusMiles };
}

function normalizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  // Strip IPv4-mapped IPv6 prefix if present
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

/**
 * Server-side write gate. Uses Vercel IP + geo headers (not client-supplied).
 * Allow: exact IP allowlist OR (US + AL + within env radius of env center).
 * No Birmingham coordinates in source — set them in Vercel env only.
 */
export function evaluateWriteAccess(request: Request): WriteAccessResult {
  if (bypassEnabled()) {
    return { allowed: true, reason: "bypass" };
  }

  const ip = normalizeIp(ipAddress(request));
  const allowedIps = parseAllowedIps(process.env.WRITE_ALLOWED_IPS);
  if (ip && allowedIps.has(ip)) {
    return { allowed: true, reason: "office" };
  }

  const geoCfg = geoConfigured();
  if (!geoCfg) {
    return { allowed: false, reason: "denied" };
  }

  const geo = geolocation(request);
  if (geo.country !== "US" || geo.countryRegion !== "AL") {
    return { allowed: false, reason: "denied" };
  }

  const lat = parseNumber(geo.latitude);
  const lon = parseNumber(geo.longitude);
  if (lat === null || lon === null) {
    return { allowed: false, reason: "denied" };
  }

  const distance = milesBetween(geoCfg.lat, geoCfg.lon, lat, lon);
  if (distance <= geoCfg.radiusMiles) {
    return { allowed: true, reason: "geo" };
  }

  return { allowed: false, reason: "denied" };
}

export function writeDeniedResponse(message: string = WRITE_DENIED_MESSAGE) {
  return Response.json(
    { error: message, code: WRITE_DENIED_CODE },
    { status: 403 }
  );
}
