/* src/pages/api/raise-insights.ts
   Market fetcher for the Raise Planner — tuned for engineering roles (esp. Network Engineer).
   Fixes “thin market” medians by:
     - Using synonym OR-queries FIRST (network admin, NOC, sr network eng, SD-WAN, etc.)
     - Requiring a minimum posting count before trusting a dataset
     - Widening time range and categories (IT + Engineering)
     - Falling back to national scope if local is thin
   Output shape matches your UI: { adzuna, macro, diagnostics }

   Env vars required:
     ADZUNA_APP_ID=xxxx
     ADZUNA_APP_KEY=xxxx
   Optional:
     DEFAULT_COUNTRY=us   // Adzuna country code: us, gb, ca, au, de, nl, ...
*/

import type { APIRoute } from "astro";

// ---------- config ----------
const MIN_REPRESENTATIVE_COUNT = 10; // don't trust medians from fewer than this
const DEFAULT_DISTANCE_KM = 160;     // ~100 miles
const LOCAL_LOOKBACK_DAYS = 120;     // widen local window for fuller sample
const BROAD_LOOKBACK_DAYS = 180;     // broader/older for synonyms
const NATIONAL_LOOKBACK_DAYS = 365;  // national fallback

// ---------- env ----------
const env = (name: string, d?: string) =>
  (import.meta.env[name] ?? process.env[name] ?? d) as string | undefined;

const ADZUNA_APP_ID = env("ADZUNA_APP_ID")!;
const ADZUNA_APP_KEY = env("ADZUNA_APP_KEY")!;
const DEFAULT_COUNTRY = (env("DEFAULT_COUNTRY", "us") || "us").toLowerCase();

// ---------- types ----------
type AdzunaJob = {
  title?: string;
  company?: { display_name?: string };
  location?: { area?: string[]; display_name?: string };
  salary_min?: number;
  salary_max?: number;
  created?: string;
  category?: { label?: string };
  contract_type?: string; // permanent/contract
  contract_time?: string; // full_time/part_time
  latitude?: number;
  longitude?: number;
  remote?: boolean;
};

type AdzunaResp = { results: AdzunaJob[]; count?: number };

// ---------- utils ----------
const num = (x: any) => (Number.isFinite(+x) ? +x : null);

function median(ns: number[]): number | null {
  const a = ns.filter(n => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
const pct = (arr: number[], p: number) => {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const idx = Math.max(0, Math.min(a.length - 1, Math.round((p / 100) * (a.length - 1))));
  return a[idx];
};

function areaToCityState(area?: string[]) {
  if (!area?.length) return "";
  const parts = area.slice(-2); // typically ["Florida","Saint Petersburg"]
  return parts.join(", ");
}

function normTitle(raw: string) {
  const t = raw.trim().toLowerCase();
  const synonyms: Record<string, string[]> = {
    "network engineer": [
      "network engineer",
      "sr network engineer",
      "senior network engineer",
      "principal network engineer",
      "network administrator",
      "network admin",
      "noc engineer",
      "network operations engineer",
      "systems/network engineer",
      "routing and switching",
      "routing & switching",
      "r&s",
      "wan engineer",
      "sd-wan",
      "lan/wan",
      "telecom network",
      "ip network engineer",
      "network specialist"
    ],
  };

  for (const k of Object.keys(synonyms)) {
    if (t.includes(k)) return { base: k, list: synonyms[k] };
  }
  // generic fallback
  const base = t.replace(/\s+/g, " ").trim();
  const list = Array.from(
    new Set([
      base,
      base.replace(/\bengineer\b/, "engineering"),
      base.replace(/\bengineer\b/, "administrator"),
    ])
  );
  return { base, list };
}

function demandTextFromCount(n: number) {
  if (n >= 500) return "very high";
  if (n >= 200) return "high";
  if (n >= 75) return "normal";
  if (n > 0) return "low";
  return "—";
}

function mapRecent(results: AdzunaJob[]) {
  const now = Date.now();
  return results
    .filter(j => j.created)
    .slice(0, 20)
    .map(j => {
      const min = num(j.salary_min);
      const max = num(j.salary_max);
      const ageDays = j.created ? Math.max(0, Math.round((now - new Date(j.created).getTime()) / 86400000)) : null;
      return {
        title: j.title || "",
        company: j.company?.display_name || "",
        salaryMin: min ?? undefined,
        salaryMax: max ?? undefined,
        location: j.location?.display_name || areaToCityState(j.location?.area) || "",
        ageDays: ageDays ?? undefined
      };
    });
}

function topTitleTokens(results: AdzunaJob[]) {
  const stop = new Set(["senior","sr","jr","ii","iii","iv","lead","principal","staff","and","of","for","with","the","a","an","remote"]);
  const counts: Record<string, number> = {};
  for (const r of results) {
    const t = (r.title || "").toLowerCase().replace(/[^a-z0-9+./-]+/g, " ");
    for (const w of t.split(/\s+/)) {
      if (!w || stop.has(w) || w.length < 2) continue;
      counts[w] = (counts[w] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([name, count]) => ({ name, count }));
}

function splits(results: AdzunaJob[]) {
  const contractSplit = { permanent: 0, contract: 0, other: 0 };
  const timeSplit = { full_time: 0, part_time: 0, other: 0 };
  let remoteMentions = 0;

  for (const r of results) {
    const ct = (r.contract_type || "").toLowerCase();
    if (ct === "permanent") contractSplit.permanent++;
    else if (ct === "contract") contractSplit.contract++;
    else contractSplit.other++;

    const tm = (r.contract_time || "").toLowerCase();
    if (tm === "full_time") timeSplit.full_time++;
    else if (tm === "part_time") timeSplit.part_time++;
    else timeSplit.other++;

    const title = (r.title || "").toLowerCase();
    const loc = (r.location?.display_name || "").toLowerCase();
    if (r.remote || title.includes("remote") || loc.includes("remote")) remoteMentions++;
  }

  const total = Math.max(1, results.length);
  return {
    contractSplit,
    timeSplit,
    remoteShare: remoteMentions / total
  };
}

function payStats(results: AdzunaJob[]) {
  const mids: number[] = [];
  for (const r of results) {
    const lo = num(r.salary_min), hi = num(r.salary_max);
    if (lo != null && hi != null && hi > 0) mids.push((lo + hi) / 2);
    else if (lo != null) mids.push(lo);
    else if (hi != null) mids.push(hi);
  }
  const med = median(mids);
  const p25v = pct(mids, 25);
  const p75v = pct(mids, 75);
  return { median: med, p25: p25v, p75: p75v, sampleCount: mids.length };
}

function topCompanies(results: AdzunaJob[]) {
  const map: Record<string, { name: string; count: number; medSalary?: number }> = {};
  for (const r of results) {
    const name = r.company?.display_name?.trim();
    if (!name) continue;
    const lo = num(r.salary_min), hi = num(r.salary_max);
    const mid = lo != null && hi != null ? (lo + hi) / 2 : lo ?? hi ?? null;
    if (!map[name]) map[name] = { name, count: 0, medSalary: undefined };
    map[name].count++;
    if (mid != null) {
      map[name].medSalary = map[name].medSalary ? (map[name].medSalary + mid) / 2 : mid; // rough rolling median
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 12);
}

async function adzunaSearch(country: string, params: Record<string, string | number | undefined>) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    return { ok: false, error: "Missing ADZUNA_APP_ID/ADZUNA_APP_KEY", data: null as any };
  }
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set("app_id", ADZUNA_APP_ID);
  url.searchParams.set("app_key", ADZUNA_APP_KEY);
  url.searchParams.set("results_per_page", "50");
  url.searchParams.set("content-type", "application/json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) return { ok: false, error: `Adzuna ${res.status}`, data: null as any };
  const data = (await res.json()) as AdzunaResp;
  return { ok: true, error: null, data };
}

// Minimal macro; can be wired to live BLS later.
function getMacro() {
  return { budget: 3.5, cpi_yoy: 3.0, eci_yoy: 3.0 };
}

// ---------- route ----------
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const location = String(body?.location || "").trim();
    const salary = num(body?.salary);

    const { base, list } = normTitle(title);

    const locLower = location.toLowerCase();
    const country =
      locLower.includes("united states") ||
      /\b[A-Z]{2}\b/.test(location) ||
      /,\s*[A-Z]{2}$/i.test(location)
        ? "us"
        : DEFAULT_COUNTRY;

    type Step = { label: string; params: Record<string, string | number | undefined> };
    const catIT = "it-jobs";
    const catEng = "engineering-jobs";
    const where = location || undefined;

    // NOTE: Synonyms FIRST to match real market variety (what your jobs page shows)
    const steps: Step[] = [
      { label: "local_synonyms",
        params: { what_or: list.join(","), where, distance: DEFAULT_DISTANCE_KM, category: `${catIT},${catEng}`, max_days_old: LOCAL_LOOKBACK_DAYS } },
      { label: "local_relaxed",
        params: { what: base, where, distance: DEFAULT_DISTANCE_KM, category: catIT, max_days_old: LOCAL_LOOKBACK_DAYS } },
      { label: "local_broaden_cat",
        params: { what: base, where, distance: DEFAULT_DISTANCE_KM, category: `${catIT},${catEng}`, max_days_old: BROAD_LOOKBACK_DAYS } },
      { label: "local_title_only",
        params: { what: base, where, distance: DEFAULT_DISTANCE_KM, title_only: 1, category: `${catIT},${catEng}`, max_days_old: BROAD_LOOKBACK_DAYS } },
      { label: "national_synonyms",
        params: { what_or: list.join(","), category: `${catIT},${catEng}`, max_days_old: NATIONAL_LOOKBACK_DAYS } },
    ];

    const diagnostics: any = {
      title_input: title,
      normalized_title: base,
      synonym_count: list.length,
      location_input: location,
      country_chosen: country,
      min_representative_count: MIN_REPRESENTATIVE_COUNT,
      steps_tried: [] as any[],
    };

    let picked: { data: AdzunaResp; step: string } | null = null;
    let bestSoFar: { data: AdzunaResp; step: string } | null = null;

    for (const s of steps) {
      const resp = await adzunaSearch(country, s.params);
      const count = resp.data?.count ?? 0;
      diagnostics.steps_tried.push({ label: s.label, ok: resp.ok, error: resp.error, params: s.params, count });
      if (resp.ok && (resp.data?.results?.length ?? 0) > 0) {
        // track best dataset by count in case none meet the representative threshold
        if (!bestSoFar || count > (bestSoFar.data.count ?? 0)) {
          bestSoFar = { data: resp.data!, step: s.label };
        }
        if (count >= MIN_REPRESENTATIVE_COUNT) {
          picked = { data: resp.data!, step: s.label };
          break;
        }
      }
    }

    const macro = getMacro();

    const chosen = picked ?? bestSoFar;
    if (!chosen) {
      return new Response(JSON.stringify({ adzuna: null, macro, diagnostics }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const results = chosen.data.results || [];
    const count = chosen.data.count ?? results.length;

    // compute summaries
    const pay = payStats(results);
    const demandText = demandTextFromCount(count);
    const recent = mapRecent(results).slice(0, 12);
    const companies = topCompanies(results);
    const { contractSplit, timeSplit, remoteShare } = splits(results);

    // hotspots by display name
    const locCount: Record<string, number> = {};
    for (const r of results) {
      const loc = r.location?.display_name || areaToCityState(r.location?.area) || "—";
      locCount[loc] = (locCount[loc] || 0) + 1;
    }
    const locations = Object.entries(locCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, c]) => ({ name, count: c }));

    const skills = topTitleTokens(results);

    const adzuna = {
      median: pay.median,
      p25: pay.p25,
      p75: pay.p75,
      count,
      demandText,
      recent,
      companies,
      locations,
      skills,
      contractSplit,
      timeSplit,
      remoteShare,
      sourceStep: picked ? picked.step : `${chosen.step}-best_available`,
    };

    return new Response(JSON.stringify({ adzuna, macro, diagnostics }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "server_error" }), { status: 500 });
  }
};
