#!/usr/bin/env node
// provider-edge.mjs
// Discover the first hop on the ISP side (beyond your private/CGN gateway)
// and explicitly AVOID picking any hop that belongs to the DESTINATION's ASN
// (e.g., Cloudflare for 1.1.1.1, Google for 8.8.8.8).
// Works on macOS/Linux/WSL (traceroute/tracepath/mtr) and Windows (tracert).
// Node 18+ required (for built-in fetch).

import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import dns from "node:dns/promises";

const exec = promisify(_exec);

// -------- args / config --------
const ARGS = process.argv.slice(2);
const WANT_JSON = ARGS.includes("--json");
const DEBUG = ARGS.includes("--debug");
const ALLOW_CGN = ARGS.includes("--allow-cgn"); // last-resort fallback if no public edge visible

// Override targets: --targets=1.1.1.1,8.8.8.8
const targetsFlag = ARGS.find(a => a.startsWith("--targets="));
const TARGETS = targetsFlag
  ? targetsFlag.replace("--targets=", "").split(",").map(s => s.trim()).filter(Boolean)
  : ["1.1.1.1", "8.8.8.8", "9.9.9.9", "208.67.222.222"]; // Cloudflare, Google, Quad9, OpenDNS

const HOP_LIMIT = 8;   // we only need the first few hops
const TIMEOUT_S = 12;

function logd(...a){ if (DEBUG) console.error("[debug]", ...a); }

// Non-Internet ranges: RFC1918, loopback, link-local, CGNAT, benchmarking, test-nets, multicast
function isNonInternet(ip) {
  return !!ip && (
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^127\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(ip) || // 100.64/10 CGNAT
    /^198\.(1[89])\./.test(ip) ||                           // 198.18/15 benchmarking
    /^192\.0\.0\./.test(ip) || /^192\.0\.2\./.test(ip) ||
    /^198\.51\.100\./.test(ip) || /^203\.0\.113\./.test(ip) ||
    /^(22[4-9]|23\d)\./.test(ip)                            // multicast
  );
}

function parseHops(text) {
  const lines = String(text).split(/\r?\n/);
  const hops = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || /timed\s*out/i.test(s)) continue;
    const m = s.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    if (!m) continue;
    const ip = m[1];
    const rtts = Array.from(s.matchAll(/(\d+(?:\.\d+)?)\s*ms/gi)).map(m => parseFloat(m[1]));
    const rtt = rtts.length ? Math.min(...rtts) : undefined;
    hops.push({ ip, rtt });
  }
  // collapse immediate duplicates
  return hops.filter((h,i,a)=> i === 0 || h.ip !== a[i-1].ip);
}

async function run(cmd, name) {
  try {
    logd("exec:", cmd);
    const { stdout } = await exec(cmd, { timeout: TIMEOUT_S * 1000, windowsHide: true });
    const hops = parseHops(stdout);
    logd(name, "hops:", hops);
    return hops;
  } catch (e) {
    logd(name, "failed:", e.message);
    return [];
  }
}

async function getHops(target) {
  let hops = [];
  if (process.platform === "win32") {
    // Windows
    hops = await run(`tracert -d -h ${HOP_LIMIT} -w 2000 ${target}`, "tracert");
  } else {
    // Unix-like
    hops = await run(`traceroute -n -m ${HOP_LIMIT} -w 2 -q 1 ${target}`, "traceroute icmp");
    if (!hops.length) {
      const tcp = await run(`traceroute -T -p 443 -n -m ${HOP_LIMIT} -w 2 -q 1 ${target}`, "traceroute tcp:443");
      if (tcp.length) hops = tcp;
    }
    if (!hops.length) {
      const tp = await run(`tracepath -n -m ${HOP_LIMIT} ${target}`, "tracepath");
      if (tp.length) hops = tp;
    }
    if (!hops.length) {
      const mtr = await run(`mtr -n -r -c 1 ${target}`, "mtr");
      if (mtr.length) hops = mtr;
    }
  }

  // Remote fallbacks if local tools blocked
  if (!hops.length) {
    try {
      const r = await fetch(`https://api.iptrace.dev/api/trace/${encodeURIComponent(target)}`, {
        cache: "no-store",
        headers:{ "User-Agent":"ProviderEdge/ASNSkip/1.0" }
      });
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j.hops)) {
          hops = j.hops
            .map(h => ({ ip: h.ip || h.address, rtt: Array.isArray(h.rtts)? Math.min(...h.rtts) : h.rtt }))
            .filter(h => !!h.ip);
          logd("iptrace.dev hops:", hops);
        }
      }
    } catch (e) { logd("iptrace.dev failed:", e.message); }
  }

  if (!hops.length) {
    try {
      const r = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(target)}`, {
        cache: "no-store",
        headers:{ "User-Agent":"ProviderEdge/ASNSkip/1.0" }
      });
      if (r.ok) {
        const txt = await r.text();
        if (!/exceeded|rate\s*limit/i.test(txt)) {
          const mtrHops = parseHops(txt);
          if (mtrHops.length) hops = mtrHops;
          logd("hackertarget mtr hops:", hops);
        } else {
          logd("hackertarget mtr: rate limited");
        }
      }
    } catch (e) { logd("hackertarget mtr failed:", e.message); }
  }

  return hops;
}

// -------- enrichment / ASN cache --------
const ORG_EXCLUDE = /google|cloudflare|amazon|aws|akamai|microsoft|azure|oracle|facebook|meta|edgecast|vercel|netlify|fastly|leaseweb|digitalocean|linode|ovh|choopa|vultr|hivelocity|i3d|hetzner|gcore|stackpath|cdn/i;
const enrichCache = new Map(); // ip -> { ip, hostname, asn, org, city, region, country, latitude, longitude }

async function enrich(ip) {
  if (!ip) return {};
  if (enrichCache.has(ip)) return enrichCache.get(ip);
  const out = { ip };
  try { const rev = await dns.reverse(ip); if (rev?.[0]) out.hostname = rev[0]; } catch {}
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      out.city = j.city;
      out.region = j.region;
      out.country = j.country_name || j.country;
      out.latitude = j.latitude;
      out.longitude = j.longitude;
      out.asn = j.asn;
      out.org = j.org || j.org_name || j.asn_org;
    }
  } catch {}
  enrichCache.set(ip, out);
  return out;
}

// Pick ISP edge for a single trace:
//  - identify first private/CGN gateway index
//  - walk forward; for each public hop:
//      * skip if IP == destination
//      * skip if hop ASN == destination ASN
//      * skip if ORG_EXCLUDE matches
//    choose the first that passes filters
async function pickProviderForTrace(hops, target, dstASN, allowCGN=false) {
  if (!Array.isArray(hops) || hops.length === 0) return { gateway: undefined, provider: undefined };

  // Gateway = first private/CGN hop
  const gwIdx = hops.findIndex(h => isNonInternet(h.ip));
  const gateway = gwIdx >= 0 ? hops[gwIdx] : undefined;

  // Build candidate list: hops after gateway (or from start if no private seen)
  const start = gwIdx >= 0 ? gwIdx + 1 : 0;
  const candidates = [];
  for (let i = start; i < hops.length; i++) {
    const ip = hops[i]?.ip;
    if (!ip) continue;
    if (ip === target && i === hops.length - 1) continue; // never the destination
    candidates.push(hops[i]);
  }

  // Evaluate first few candidates with ASN filter
  const toCheck = candidates.slice(0, 6); // keep lookups modest
  let cgnFallback = null;

  for (const cand of toCheck) {
    const ip = cand.ip;
    if (!ip) continue;

    // CGN/private after gw (remember as last-resort if requested)
    if (isNonInternet(ip)) { if (!cgnFallback) cgnFallback = cand; continue; }

    // Enrich to get ASN/Org
    const meta = await enrich(ip);
    // Skip if same ASN as destination (e.g., 1.1.1.1 -> Cloudflare ASN)
    if (meta.asn && dstASN && String(meta.asn).toUpperCase() === String(dstASN).toUpperCase()) {
      logd("skip candidate (same ASN as dst):", ip, meta.asn);
      continue;
    }
    // Skip obvious clouds/CDNs
    if (ORG_EXCLUDE.test(meta.org || "")) {
      logd("skip candidate (ORG_EXCLUDE):", ip, meta.org);
      continue;
    }

    // Accept earliest passing candidate
    return { gateway, provider: cand };
  }

  // If allowed, fall back to first post-gateway CGN candidate
  if (allowCGN && cgnFallback) return { gateway, provider: cgnFallback };

  // As a safety, if nothing passed, return the earliest public candidate not equal to destination
  const firstPublic = candidates.find(c => c.ip && !isNonInternet(c.ip) && c.ip !== target);
  if (firstPublic) return { gateway, provider: firstPublic };

  return { gateway, provider: undefined };
}

function median(nums){ const a=nums.slice().sort((x,y)=>x-y); const m=a.length>>1; return a.length%2?a[m]:(a[m-1]+a[m])/2; }

(async function main(){
  // Run short traces to multiple neutral targets and pick ISP edge per trace
  const perTrace = [];

  for (const t of TARGETS) {
    const hops = await getHops(t);
    if (!hops.length) { perTrace.push({ target: t, error: "no-hops" }); continue; }

    // Get destination ASN (so we can skip hops that belong to the destination network)
    let dstASN = null;
    try { const dstMeta = await enrich(t); dstASN = dstMeta.asn || null; } catch {}
    logd("dst ASN for", t, "=", dstASN);

    const { gateway, provider } = await pickProviderForTrace(hops, t, dstASN, ALLOW_CGN);
    perTrace.push({ target: t, gateway, provider, hops });
  }

  // Tally provider candidates across traces (vote by frequency, then best median RTT)
  const byIP = new Map();
  for (const r of perTrace) {
    const p = r.provider;
    if (!p?.ip) continue;
    const k = p.ip;
    const arr = byIP.get(k) || [];
    arr.push(typeof p.rtt === "number" ? p.rtt : null);
    byIP.set(k, arr);
  }

  if (byIP.size === 0) {
    const err = {
      error: "Could not identify provider-edge hop (intermediate hops likely filtered).",
      traces: perTrace.map(r => ({ target: r.target, hops: Array.isArray(r.hops) ? r.hops.map(h=>h.ip) : [] }))
    };
    return WANT_JSON ? console.log(JSON.stringify(err, null, 2)) : console.log(err.error);
  }

  let best = null;
  for (const [ip, arr] of byIP.entries()) {
    const freq = arr.length;
    const rtts = arr.filter(x => typeof x === "number");
    const scoreRtt = rtts.length ? median(rtts) : Infinity;
    if (!best || freq > best.freq || (freq === best.freq && scoreRtt < best.scoreRtt)) {
      best = { ip, freq, scoreRtt };
    }
  }

  // Enrich the selected provider edge
  const chosenMeta = await enrich(best.ip);

  // Also enrich the most common private/CGN gateway we saw
  const gwCount = new Map();
  for (const r of perTrace) {
    const gw = r.gateway?.ip;
    if (!gw) continue;
    gwCount.set(gw, (gwCount.get(gw) || 0) + 1);
  }
  let gatewayIP, gatewayHost, gatewayRTT;
  if (gwCount.size) {
    gatewayIP = [...gwCount.entries()].sort((a,b)=>b[1]-a[1])[0][0];
    try { const rev = await dns.reverse(gatewayIP); gatewayHost = rev?.[0]; } catch {}
    const sample = perTrace.find(r => r.gateway?.ip === gatewayIP)?.gateway;
    if (typeof sample?.rtt === "number") gatewayRTT = Math.round(sample.rtt);
  }

  // Output
  if (WANT_JSON) {
    return console.log(JSON.stringify({
      targets: TARGETS,
      gateway: gatewayIP ? { ip: gatewayIP, hostname: gatewayHost, private: isNonInternet(gatewayIP), rtt: gatewayRTT } : null,
      provider: {
        ip: chosenMeta.ip,
        hostname: chosenMeta.hostname,
        asn: chosenMeta.asn,
        org: chosenMeta.org,
        city: chosenMeta.city,
        region: chosenMeta.region,
        country: chosenMeta.country,
        latitude: chosenMeta.latitude,
        longitude: chosenMeta.longitude
      },
      votes: Object.fromEntries([...byIP.entries()].map(([k,v])=>[k, v.length])),
      traces: perTrace.map(r => ({ target: r.target, hops: Array.isArray(r.hops) ? r.hops.map(h=>h.ip) : [] }))
    }, null, 2));
  }

  // Pretty print
  console.log(`Targets used: ${TARGETS.join(", ")}`);
  if (gatewayIP) {
    console.log(`Gateway (private/CGN): ${gatewayIP}${gatewayHost?`  (${gatewayHost})`:''}${typeof gatewayRTT==='number'?`  ~${gatewayRTT} ms`:''}`);
  }
  console.log(`Provider Edge (voted, excluding destination ASN & cloud/CDN):`);
  console.log(`  IP       : ${chosenMeta.ip}`);
  console.log(`  Hostname : ${chosenMeta.hostname || '—'}`);
  console.log(`  ASN/Org  : ${[chosenMeta.asn, chosenMeta.org].filter(Boolean).join(' · ') || '—'}`);
  console.log(`  Location : ${[chosenMeta.city, chosenMeta.region, chosenMeta.country].filter(Boolean).join(', ') || '—'}`);
  if (typeof chosenMeta.latitude === 'number' && typeof chosenMeta.longitude === 'number') {
    console.log(`  Lat/Lon  : ${chosenMeta.latitude}, ${chosenMeta.longitude}`);
  }
  console.log(`(Tip: --json for machine-readable output, --targets=ip1,ip2 to customize, --allow-cgn for CGN last-resort.)`);
})();
