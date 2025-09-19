// Pre-generated static endpoint that snapshots external JSON feeds at BUILD time.
// Route: /api/netfetch  (emitted as a real JSON file at build time)
// IMPORTANT: This runs during `astro build` (CI). If a source is down during build, we skip it gracefully.

export const prerender = true;

type Source = {
  key: string;          // unique key used in the aggregated JSON
  url: string;          // external JSON/CSV/NDJSON/whatever; we try JSON first
  type?: "json" | "text"; // default "json" (we'll try to parse JSON, else store as text)
  timeoutMs?: number;   // per-source timeout
};

const SOURCES: Source[] = [
  {
    key: "github_status",
    url: "https://www.githubstatus.com/api/v2/summary.json",
    type: "json",
    timeoutMs: 7000,
  },
  {
    key: "cloudflare_status",
    url: "https://www.cloudflarestatus.com/api/v2/summary.json",
    type: "json",
    timeoutMs: 7000,
  },
  // Add more sources as needed
];

async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function pullSources() {
  const results: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    SOURCES.map(async (src) => {
      try {
        const res = await fetchWithTimeout(src.url, src.timeoutMs ?? 7000);
        if (!res.ok) {
          errors[src.key] = `HTTP ${res.status}`;
          return;
        }
        if ((src.type ?? "json") === "json") {
          // Try JSON first; fall back to text if parsing fails
          const text = await res.text();
          try {
            results[src.key] = JSON.parse(text);
          } catch {
            results[src.key] = { raw: text };
          }
        } else {
          results[src.key] = await res.text();
        }
      } catch (e: any) {
        errors[src.key] = e?.message ?? "unknown error";
      }
    })
  );

  return { results, errors };
}

export async function GET() {
  const { results, errors } = await pullSources();

  const payload = {
    meta: {
      title: "Network Feed Snapshot",
      description: "Aggregated external status feeds captured at build time.",
      builtAt: new Date().toISOString(),
      sources: SOURCES.map(({ key, url }) => ({ key, url })),
      okCount: Object.keys(results).length,
      errorCount: Object.keys(errors).length,
    },
    data: results,
    errors,
  };

  const body = JSON.stringify(payload, null, 2);

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=1800, immutable",
    },
  });
}
