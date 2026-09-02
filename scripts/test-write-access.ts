/**
 * Local sanity checks for write-access math (no production geo coordinates).
 * Run: npx tsx scripts/test-write-access.ts
 */
import { milesBetween, evaluateWriteAccess } from "../src/lib/write-access";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Arbitrary points — not the production center
const origin = { lat: 10, lon: 20 };
const nearby = milesBetween(origin.lat, origin.lon, 10.1, 20.1);
assert(nearby > 0 && nearby < 20, `nearby unexpected: ${nearby}`);

const far = milesBetween(origin.lat, origin.lon, 40, -70);
assert(far > 1000, `far unexpected: ${far}`);

process.env.WRITE_ACCESS_BYPASS = "true";
const bypassed = evaluateWriteAccess(new Request("http://localhost/api/games"));
assert(bypassed.allowed && bypassed.reason === "bypass", "bypass failed");

process.env.WRITE_ACCESS_BYPASS = "false";
process.env.WRITE_ALLOWED_IPS = "203.0.113.10";
process.env.WRITE_GEO_CENTER_LAT = "10";
process.env.WRITE_GEO_CENTER_LON = "20";
process.env.WRITE_GEO_RADIUS_MILES = "50";

const office = evaluateWriteAccess(
  new Request("http://localhost/api/games", {
    headers: { "x-real-ip": "203.0.113.10" },
  })
);
assert(office.allowed && office.reason === "office", `office: ${JSON.stringify(office)}`);

const geoOk = evaluateWriteAccess(
  new Request("http://localhost/api/games", {
    headers: {
      "x-real-ip": "198.51.100.1",
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "AL",
      "x-vercel-ip-latitude": "10.05",
      "x-vercel-ip-longitude": "20.05",
    },
  })
);
assert(geoOk.allowed && geoOk.reason === "geo", `geo: ${JSON.stringify(geoOk)}`);

const geoDeny = evaluateWriteAccess(
  new Request("http://localhost/api/games", {
    headers: {
      "x-real-ip": "198.51.100.2",
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "NY",
      "x-vercel-ip-latitude": "40.71",
      "x-vercel-ip-longitude": "-74.00",
    },
  })
);
assert(
  !geoDeny.allowed && geoDeny.reason === "denied",
  `deny: ${JSON.stringify(geoDeny)}`
);

console.log("write-access checks passed");
