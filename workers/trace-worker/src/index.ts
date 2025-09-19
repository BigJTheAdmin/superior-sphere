export interface Env {
  ALLOW_ORIGIN: string;
  AUTH_TOKEN: string;
  GEO_PROVIDER: "ip-api" | "ipdata";
  IPDATA_KEY: string;
}

type HopGeo = {
  lat: number; lon: number;
  city?: string; region?: string; country?: string;
  asn?: string; org?: string;
} | null;

type Hop = {
  hop: number;
  host: string;
  ip?: string | null;
  loss?: number;
  sent?: number;
  last?: number;
  avg?: number;
  best?: number;
  worst?: number;
  stdev?: number;
  geo?: HopGeo;
};

const HOST_RE = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$|^(?:\d{1,3}\.){3}\d{1,3}$/;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function cors(env: Env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function j(body: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(env ? cors(env) : {}),
      "cache-control": "no-store",
    },
  });
}

async function geo(ip: string, env: Env): Promise<HopGeo> {
  if (!ip || ip === "*" || ip === "0.0.0.0") return null;

  if (env.GEO_PROVIDER === "ipdata" && env.IPDATA_KEY) {
    try {
      const r = await fetch(`https://api.ipdata.co/${ip}?api-key=${env.IPDATA_KEY}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      return { lat: d.latitude, lon: d.longitude, city: d.city, region: d.region, country: d.country_name, asn: d.asn?.asn, org: d.asn?.name };
    } catch {}
  }

  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,org,as,query`);
    if (!r.ok) throw new Error();
    const d = await r.json();
    if (d.status !== "success") return null;
    return { lat: d.lat, lon: d.lon, city: d.city, region: d.regionName, country: d.country, asn: d.as, org: d.org };
  } catch {
    return null;
  }
}

// Parse HackerTarget MTR text
function parseMtr(text: string) {
  const hops: Hop[] = [];
  const re = /^\s*(\d+)\.\|\-\-\s+(\S+)\s+(\d+(?:\.\d+)?)%\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/;
  for (const ln of text.split(/\r?\n/)) {
    const m = re.exec(ln);
    if (!m) continue;
    const [ , hop, host, loss, sent, last, avg, best, worst, stdev ] = m;
    hops.push({
      hop: Number(hop),
      host,
      ip: IP_RE.test(host) ? host : null,
      loss: Number(loss),
      sent: Number(sent),
      last: Number(last),
      avg:  Number(avg),
      best: Number(best),
      worst:Number(worst),
      stdev:Number(stdev),
    });
  }
  return hops;
}

async function doTrace(target: string) {
  const r = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(target)}`, { cf: { cacheTtl: 0 } });
  if (!r.ok) return { ok: false, error: `upstream_http_${r.status}` as const };
  const text = await r.text();
  if (/^error/i.test(text.trim())) return { ok: false, error: text.trim() as const };
  return { ok: true as const, hops: parseMtr(text) };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(env) });

    const url = new URL(req.url);
    if (url.pathname === "/health") return j({ ok: true, provider: "hackertarget", geo: env.GEO_PROVIDER }, 200, env);

    if (url.pathname === "/trace" && req.method === "POST") {
      if (env.AUTH_TOKEN) {
        const hdr = req.headers.get("authorization") || "";
        if (!(hdr.startsWith("Bearer ") && hdr.slice(7) === env.AUTH_TOKEN)) return j({ ok: false, error: "unauthorized" }, 401, env);
      }

      let body: any = {};
      try { body = await req.json(); } catch {}
      const target = String(body?.target || "").trim();
      if (!target || !HOST_RE.test(target) || target.includes("/") || target.includes(":")) return j({ ok: false, error: "invalid_target" }, 400, env);

      const start = Date.now();
      const traced = await doTrace(target);
      if (!traced.ok) return j({ ok: false, error: traced.error }, 502, env);

      const hops = traced.hops;
      const out = Array.from(hops);
      const q = out.map((h, i) => ({ i, h }));
      const workers = Array.from({ length: 6 }, async () => {
        while (q.length) {
          const { i, h } = q.shift()!;
          const ip = h.ip ?? (IP_RE.test(h.host) ? h.host : null);
          out[i].geo = ip ? await geo(ip, env) : null;
        }
      });
      await Promise.all(workers);

      return j({ ok: true, target, hops: out, source: "cloudflare-worker+hackerTarget", runtimeMs: Date.now() - start, note: "Edge vantage, not user's LAN." }, 200, env);
    }

    return j({ ok: false, error: "not_found" }, 404, env);
  },
};
