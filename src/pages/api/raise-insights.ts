// Pre-generated static endpoint providing salary/raise insight tables.
// Route: /api/raise-insights  (emitted as a real JSON file at build time)
//
// Client pattern: fetch this once, then do user-specific calculations in the browser.
// This keeps GH Pages fully static while still powering your UI.

export const prerender = true;

type Band = {
  title: string;          // e.g., "Network Engineer I"
  years: [number, number];// inclusive range
  p10: number;            // 10th percentile
  p50: number;            // median
  p90: number;            // 90th percentile
};

type RegionMultiplier = {
  region: string;         // e.g., "US-National", "SF Bay Area", "NYC", "Remote-LCOL"
  multiplier: number;     // applies to all bands
};

type CertBoost = {
  cert: string;           // e.g., "PCNSE", "AWS Advanced Networking", "CCNP Enterprise"
  boostPct: number;       // % uplift applied to base target
};

// ===== Replace/extend these with your real tables =====
const BANDS: Band[] = [
  { title: "Network Engineer I",  years: [0, 2], p10: 65000, p50: 80000, p90: 100000 },
  { title: "Network Engineer II", years: [2, 5], p10: 90000, p50: 115000, p90: 140000 },
  { title: "Senior Network Engineer", years: [5, 9], p10: 120000, p50: 145000, p90: 180000 },
  { title: "Network Architect", years: [9, 99], p10: 150000, p50: 185000, p90: 240000 },
];

const REGIONS: RegionMultiplier[] = [
  { region: "US-National", multiplier: 1.00 },
  { region: "SF Bay Area", multiplier: 1.25 },
  { region: "NYC", multiplier: 1.18 },
  { region: "Remote-HCOL", multiplier: 1.12 },
  { region: "Remote-LCOL", multiplier: 0.92 },
];

const CERTS: CertBoost[] = [
  { cert: "PCNSE", boostPct: 0.05 },
  { cert: "AWS Advanced Networking", boostPct: 0.06 },
  { cert: "CCNP Enterprise", boostPct: 0.04 },
  { cert: "JNCIA/JNCIS", boostPct: 0.02 },
];

function buildPayload() {
  return {
    meta: {
      title: "Raise Insights (Static Tables)",
      description: "Salary bands, regional multipliers, and certification boosts for client-side calculations.",
      builtAt: new Date().toISOString(),
      counts: { bands: BANDS.length, regions: REGIONS.length, certs: CERTS.length },
    },
    bands: BANDS,
    regions: REGIONS,
    certs: CERTS,
    // Small example calculator spec the client can follow
    calculatorSpec: {
      steps: [
        "Pick a base percentile from bands (p50 recommended).",
        "Multiply by region.multiplier.",
        "Apply cumulative certification boosts (e.g., 5% + 6% = 11%).",
        "Round to nearest $500 for presenting targets.",
      ],
      example: {
        title: "Senior Network Engineer (7y), NYC, PCNSE + AWS ANS",
        formula: "p50(145000) * 1.18 * (1 + 0.05 + 0.06) ≈ 190,000",
      },
    },
  };
}

export async function GET() {
  const body = JSON.stringify(buildPayload(), null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=604800, immutable", // 7 days
    },
  });
}
