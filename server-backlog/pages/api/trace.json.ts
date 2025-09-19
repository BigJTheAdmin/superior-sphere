/* Provider-edge resolver for the NOC page
   - Local tries: traceroute (ICMP), traceroute TCP:443, tracepath, mtr, tracert (Win)
   - Fallbacks: iptrace.dev, hackertarget.com
   - Detects first non-Internet hop (private/CGN/etc.) as "gateway"
   - Returns the first responding hop *after* gateway as "provider" (the one you want)
   - Enriches provider with rDNS + Geo; includes 'debug' trail
*/
import type { APIRoute } from "astro";
import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import dns from "node:dns/promises";

const exec = promisify(_exec);
export const prerender = false;

type Hop = { ip?: string; rtt?: number };
type Attempt = { step: string; ok: boolean; note?: string; sample?: string };

function isHost(x: string) { return /^[a-z0-9.-]+$/i.test(x); }

/** RFC1918, link-local, loopback, CGNAT 100.64/10, benchmarking/test nets, multicast, etc. */
function isNonInternet(ip?: string) {
  if (!ip) return false;
  return (
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^127\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(ip) ||   // CGNAT
    /^198\.(1[89])\./.test(ip) ||                             // 198.18/15
    /^192\.0\.0\./.test(ip) || /^192\.0\.2\./.test(ip) ||
    /^198\.51\.100\./.test(ip) || /^203\.0\.113\./.test(ip) ||
    /^(22[4-9]|23\d)\./.test(ip)
  );
}

function parseHops(text: string): Hop[] {
  const lines = text.split(/\r?\n/);
  const hops: Hop[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || /timed\s*out/i.test(s)) continue;
    const ipMatch = s.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    if (!ipMatch) continue;
    const ip = ipMatch[1];
    const rtts = Array.from(s.matchAll(/(\d+(?:\.\d+)?)\s*ms/gi)).map((m) => parseFloat(m[1]));
    const rtt = rtts.length ? Math.min(...rtts) : undefined;
    hops.push({ ip, rtt });
  }
  // collapse immediate duplicates (some tools echo same hop)
  return hops.filter((h, i, a) => i === 0 || h.ip !== a[i - 1].ip);
}

/** Gateway = first private/CGN hop; Provider = first responding hop after gateway. */
function splitGatewayAndProvider(hops: Hop[]) {
  let gateway: Hop | undefined;
  let provider: Hop | undefined;

  const gwIdx = hops.findIndex((h) => isNonInternet(h.ip));
  if (gwIdx >= 0) {
    gateway = hops[gwIdx];
    for (let i = gwIdx + 1; i < hops.length; i++) {
      if (hops[i].ip && hops[i].ip !== gateway.ip) { provider = hops[i]; break; }
    }
  } else {
    // No obvious private hop — pick second unique hop if exists, else first public/unique
    const uniq = hops.filter((h,i,a)=>i===0 || h.ip !== a[i-1].ip);
    provider = uniq[1] || uniq.find(h=>h.ip && !isNonInternet(h.ip)) || uniq[0];
  }
  return { gateway, provider };
}

async function run(cmd: string, step: string, debug: Attempt[], timeoutMs = 12000) {
  try {
    const { stdout } = await exec(cmd, { timeout: timeoutMs, windowsHide: true });
    const hops = parseHops(stdout);
    debug.push({ step, ok: true, note: `found ${hops.length} hop line(s)`, sample: stdout.split(/\r?\n/).slice(0, 4).join("\n") });
    return hops;
  } catch (e: any) {
    debug.push({ step, ok: false, note: e?.message || "exec failed" });
    return [];
  }
}

async function fetchJSON(url: string, debug: Attempt[], step: string, timeoutMs = 8000) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ac.signal, headers: { "User-Agent": "PingTrace.NOC/1.3" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    debug.push({ step, ok: true, note: "HTTP OK" });
    return j;
  } catch (e: any) {
    debug.push({ step, ok: false, note: e?.message || "fetch failed" });
    return null;
  } finally { clearTimeout(id); }
}

export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get("target") || "1.1.1.1";
  if (!isHost(target)) {
    return new Response(JSON.stringify({ error: "Invalid target" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const debug: Attempt[] = [];
  let hops: Hop[] = [];
  let source = "local";

  // Prefer local vantage so hop #2 is YOUR provider edge
  if (process.platform === "win32") {
    hops = await run(`tracert -d -h 8 -w 2000 ${target}`, "tracert (-d -h 8 -w 2000)", debug);
  } else {
    hops = await run(`traceroute -n -m 8 -w 2 -q 1 ${target}`, "traceroute (-n -m 8 -w 2 -q 1)", debug);
    if (!splitGatewayAndProvider(hops).provider?.ip) {
      const t = await run(`traceroute -T -p 443 -n -m 8 -w 2 -q 1 ${target}`, "traceroute TCP:443", debug);
      if (t.length) hops = t;
    }
    if (!splitGatewayAndProvider(hops).provider?.ip) {
      const t = await run(`tracepath -n -m 8 ${target}`, "tracepath (-n -m 8)", debug);
      if (t.length) hops = t;
    }
    if (!splitGatewayAndProvider(hops).provider?.ip) {
      const t = await run(`mtr -n -r -c 1 ${target}`, "mtr (-n -r -c 1)", debug);
      if (t.length) hops = t;
    }
  }

  // Remote fallbacks
  if (!splitGatewayAndProvider(hops).provider?.ip) {
    source = "fallback";
    const ipt = await fetchJSON(`https://api.iptrace.dev/api/trace/${encodeURIComponent(target)}`, debug, "iptrace.dev");
    if (Array.isArray(ipt?.hops) && ipt.hops.length) {
      hops = ipt.hops.map((h: any) => ({ ip: h.ip || h.address, rtt: Array.isArray(h.rtts) ? Math.min(...h.rtts) : h.rtt }));
    } else {
      const r = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(target)}`, {
        cache: "no-store", headers: { "User-Agent": "PingTrace.NOC/1.3" },
      }).catch((e) => { debug.push({ step: "hackertarget", ok: false, note: e?.message || "fetch failed" }); return null; });
      if (r && r.ok) {
        const txt = await r.text();
        if (/exceeded/i.test(txt)) debug.push({ step: "hackertarget", ok: false, note: "rate limited" });
        else {
          hops = parseHops(txt);
          debug.push({ step: "hackertarget", ok: true, note: `found ${hops.length} hop line(s)`, sample: txt.split(/\r?\n/).slice(0, 4).join("\n") });
        }
      }
    }
  }

  const { gateway, provider } = splitGatewayAndProvider(hops);

  // Enrich
  let gwHost: string | undefined;
  let prHost: string | undefined;
  let prGeo: any = {};
  if (gateway?.ip) { try { gwHost = (await dns.reverse(gateway.ip))?.[0]; } catch {} }
  if (provider?.ip) {
    try { prHost = (await dns.reverse(provider.ip))?.[0]; } catch {}
    const j = await fetchJSON(`https://ipapi.co/${encodeURIComponent(provider.ip)}/json/`, debug, "ipapi.co", 6000);
    if (j) prGeo = j;
  }

  return new Response(JSON.stringify({
    source,
    gateway: gateway ? {
      ip: gateway.ip,
      rtt: typeof gateway.rtt === "number" ? Math.round(gateway.rtt) : undefined,
      hostname: gwHost || undefined,
      private: isNonInternet(gateway.ip),
    } : undefined,
    provider: provider ? {
      ip: provider.ip,
      rtt: typeof provider.rtt === "number" ? Math.round(provider.rtt) : undefined,
      hostname: prHost || prGeo.hostname || undefined,
      city: prGeo.city || undefined,
      region: prGeo.region || undefined,
      country: prGeo.country_name || prGeo.country || undefined,
      latitude: typeof prGeo.latitude === "number" ? prGeo.latitude : undefined,
      longitude: typeof prGeo.longitude === "number" ? prGeo.longitude : undefined,
      asn: prGeo.asn || undefined,
      org: prGeo.org || undefined,
    } : undefined,
    hops,
    debug
  }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
