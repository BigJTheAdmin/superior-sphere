// Cloudflare Worker traceroute client
const BASE = import.meta.env.PUBLIC_TRACE_RELAY_URL || ""; // set in CI/GitHub Secrets
const AUTH = import.meta.env.PUBLIC_TRACE_RELAY_AUTH || ""; // optional bearer

export type TraceHop = {
  hop: number;
  host: string;
  ip?: string | null;
  loss?: number; sent?: number; last?: number; avg?: number; best?: number; worst?: number; stdev?: number;
  geo?: { lat: number; lon: number; city?: string; region?: string; country?: string; asn?: string; org?: string } | null;
};

export async function runTrace(target: string) {
  if (!BASE) return { ok: false as const, error: "relay_not_configured" };
  const r = await fetch(`${BASE}/trace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AUTH ? { Authorization: `Bearer ${AUTH}` } : {}),
    },
    body: JSON.stringify({ target }),
  });
  if (!r.ok) return { ok: false as const, error: `http_${r.status}` };
  const j = await r.json();
  return j as { ok: boolean; hops?: TraceHop[]; error?: string; note?: string };
}