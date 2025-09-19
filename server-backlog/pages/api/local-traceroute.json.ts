/* Local Traceroute API — robust multi-attempt runner
   URL: /api/local-traceroute.json

   - Windows: uses tracert
   - Linux/macOS try in order: traceroute(UDP) -> traceroute(ICMP -I) -> mtr -> tracepath
   - Returns ALL hops (unknown hops have lat/lon = null)
   - Diagnostics include all attempts with parsed counts and raw previews
*/

export const prerender = false;

import { spawn, spawnSync } from "node:child_process";

let maxmind: typeof import("maxmind") | null = null;
let geoReader: import("maxmind").Reader<import("maxmind").CityResponse> | null = null;

type HopOut = {
  ip: string | null;
  rtt: number | null;
  lat: number | null;
  lon: number | null;
  city?: string;
  country?: string;
};

const MMDB_PATH = new URL("../../data/GeoLite2-City.mmdb", import.meta.url).pathname;

/* ---------------- utils ---------------- */
const isStr = (v: any): v is string => typeof v === "string";
const isLikelyIp = (s: any): s is string =>
  isStr(s) && s.trim() !== "*" && (
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(s) || (/^[0-9a-f:]+$/i.test(s) && s.includes(":"))
  );

const isPublic = (ip: string) =>
  !(/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip) ||
    /^fe80:/i.test(ip) || /^fc00:|^fd00:/i.test(ip));

const firstMs = (line: string) => {
  // matches "1 ms", "1.2 ms", "<1 ms"
  const m = line.match(/<?\s*(\d+(?:\.\d+)?)\s*ms/i);
  return m ? Math.round(parseFloat(m[1])) : null;
};

const which = (names: string[]) => {
  for (const n of names) {
    try {
      if (process.platform === "win32") {
        const r = spawnSync("where", [n], { encoding: "utf8" });
        if (r.status === 0 && r.stdout.trim()) return n; // name is enough to spawn
      } else {
        const r = spawnSync("which", [n], { encoding: "utf8" });
        if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split("\n")[0];
        const r2 = spawnSync("test", ["-x", `/usr/sbin/${n}`]);
        if (r2.status === 0) return `/usr/sbin/${n}`;
      }
    } catch { /* ignore */ }
  }
  return null;
};

const runCmd = (cmd: string, args: string[], timeout = 45_000) =>
  new Promise<{ out: string; err: string; cmd: string; args: string[] }>((res, rej) => {
    try {
      const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      let out = "", err = "";
      const killer = setTimeout(() => { try { p.kill(); } catch {} }, timeout);
      p.stdout.on("data", d => out += d.toString());
      p.stderr.on("data", d => err += d.toString());
      p.on("close", () => { clearTimeout(killer); res({ out, err, cmd, args }); });
      p.on("error", e => { clearTimeout(killer); rej(e); });
    } catch (e) { rej(e); }
  });

async function reader() {
  if (geoReader) return geoReader;
  if (!maxmind) maxmind = await import("maxmind");
  geoReader = await maxmind.open<import("maxmind").CityResponse>(MMDB_PATH);
  return geoReader;
}
async function geo(ip: string) {
  try {
    const r = await reader();
    const rec = r.get(ip as any);
    if (rec?.location?.latitude != null && rec?.location?.longitude != null) {
      return {
        lat: rec.location.latitude,
        lon: rec.location.longitude,
        city: rec.city?.names?.en || rec.city?.names?.en_US || "",
        country: rec.country?.names?.en || rec.country?.iso_code || "",
      };
    }
  } catch {}
  return null;
}

/* ------------- parsers ------------- */
// Works for Linux/macOS traceroute and Windows tracert (-d)
function parseTraceroute(text: string) {
  const lines = text.split(/\r?\n/);
  const out: Array<{ ip: string | null; rtt: number | null }> = [];
  const ipv4 = /(\d{1,3}(?:\.\d{1,3}){3})/;
  const ipv6 = /([0-9a-f:]+:[0-9a-f:]+)/i;

  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    if (/^traceroute to/i.test(s) || /^tracing route to/i.test(s) || /^over a maximum of/i.test(s)) continue;

    // Windows timeout line
    if (/request timed out\./i.test(s)) { out.push({ ip: null, rtt: null }); continue; }
    // Generic asterisk timeout lines
    if (/\*\s*\*\s*\*/.test(s) || /^\d+\s+\*/.test(s)) { out.push({ ip: null, rtt: null }); continue; }

    const m = s.match(ipv4) || s.match(ipv6);
    const ip = m ? m[1] : null;
    const rtt = firstMs(s);
    out.push({ ip, rtt }); // keep slot even if ip==null
  }
  return out;
}

function parseTracepath(text: string) {
  const lines = text.split(/\r?\n/);
  const out: Array<{ ip: string | null; rtt: number | null }> = [];
  const ipv4 = /(\d{1,3}(?:\.\d{1,3}){3})/;
  const ipv6 = /([0-9a-f:]+:[0-9a-f:]+)/i;

  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    if (/^ *\d+\?:/i.test(s)) continue; // pmtu
    if (/^\d+:\s+\*\s*$/i.test(s)) { out.push({ ip: null, rtt: null }); continue; }

    const m = s.match(ipv4) || s.match(ipv6);
    const ip = m ? m[1] : null;
    const rtt = firstMs(s);
    out.push({ ip, rtt });
  }
  return out;
}

function parseMtr(text: string) {
  const lines = text.split(/\r?\n/);
  const out: Array<{ ip: string | null; rtt: number | null }> = [];
  const ipre = /(?:\d+\.\|--\s+)?(\d{1,3}(?:\.\d{1,3}){3})/;

  for (const s of lines) {
    if (!/\|\-\-/.test(s)) continue;
    const m = s.match(ipre);
    const ip = m ? m[1] : null;
    const nums = s.match(/(\d+(?:\.\d+)?)/g);
    const r = nums ? Math.round(parseFloat(nums[nums.length - 5] || nums[nums.length - 4] || "0")) : null;
    out.push({ ip, rtt: Number.isFinite(r) ? r : null });
  }
  return out;
}

/* ------------- attempt sequencing ------------- */
type Parser = (s: string) => { ip: string | null; rtt: number | null }[];
type Attempt = { label: string; cmd: string; args: string[]; parse: Parser };

function availableAttempts(target: string): Attempt[] {
  const attempts: Attempt[] = [];

  if (process.platform === "win32") {
    const p = which(["tracert"]) || "tracert";
    attempts.push({ label: "tracert", cmd: p, args: ["-d", "-w", "2000", "-h", "30", target], parse: parseTraceroute });
    return attempts;
  }

  const tr = which(["traceroute"]);
  if (tr) {
    // UDP
    attempts.push({ label: "traceroute-udp", cmd: tr, args: ["-n", "-q", "1", "-w", "2", target], parse: parseTraceroute });
    // ICMP
    attempts.push({ label: "traceroute-icmp", cmd: tr, args: ["-n", "-q", "1", "-w", "2", "-I", target], parse: parseTraceroute });
  }

  const mtr = which(["mtr"]);
  if (mtr) attempts.push({ label: "mtr", cmd: mtr, args: ["-n", "-r", "-c", "1", target], parse: parseMtr });

  const tp = which(["tracepath"]);
  if (tp) attempts.push({ label: "tracepath", cmd: tp, args: ["-n", target], parse: parseTracepath });

  return attempts;
}

/* --------------- handler --------------- */
export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const target = (body?.target || "").toString().trim();
    const originIp = (body?.originIp || "").toString().trim(); // optional

    if (!target) return new Response(JSON.stringify({ error: "Missing target" }), { status: 400 });

    const attempts = availableAttempts(target);
    if (!attempts.length) {
      const install =
        process.platform === "win32"
          ? "Windows should have 'tracert' built-in."
          : "Install: Debian/Ubuntu `sudo apt-get install -y traceroute mtr-tiny` (tracepath is usually present).";
      return new Response(JSON.stringify({ error: "No traceroute tool available", install }), { status: 501 });
    }

    const attemptSummaries: any[] = [];
    let best: { hops: HopOut[]; used: any; rawPreview: string } | null = null;

    for (const a of attempts) {
      const run = await runCmd(a.cmd, a.args);
      const parsed = a.parse(run.out + "\n" + run.err);

      // Build hop objects (geolocate only public IPs)
      const hops: HopOut[] = [];
      for (const h of parsed) {
        const ip = h.ip && isLikelyIp(h.ip) ? h.ip : null;
        const base: HopOut = { ip, rtt: h.rtt ?? null, lat: null, lon: null };
        if (ip && isPublic(ip)) {
          const g = await geo(ip);
          if (g) Object.assign(base, g);
        }
        hops.push(base);
      }

      const rawPreview = (run.out + "\n" + run.err).slice(0, 1600);
      attemptSummaries.push({
        label: a.label,
        cmd: run.cmd,
        args: run.args,
        parsedCount: parsed.length,
        rawPreview: rawPreview.slice(0, 400) // keep small in the summary
      });

      if (hops.length > 0 && !best) {
        best = {
          hops,
          used: { tool: a.label, path: run.cmd, args: run.args, platform: process.platform, geodb: "MaxMind GeoLite2 City" },
          rawPreview
        };
        // we could break here, but let’s continue building summaries for debug completeness
      }
    }

    // Optional origin marker
    let origin: any = null;
    if (originIp && isLikelyIp(originIp)) {
      const g = await geo(originIp);
      if (g) origin = { ip: originIp, ...g };
    }

    if (best) {
      return new Response(JSON.stringify({
        hops: best.hops,
        origin,
        used: best.used,
        rawPreview: best.rawPreview,
        attempts: attemptSummaries
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    } else {
      // None produced output we could parse
      return new Response(JSON.stringify({
        hops: [],
        origin,
        used: null,
        rawPreview: "",
        attempts: attemptSummaries,
        hint: process.platform === "linux"
          ? "Install `traceroute` (`sudo apt-get install traceroute`) or `mtr-tiny`, then retry."
          : "No traceroute output parsed from available tools."
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Unhandled error", detail: String(e) }), { status: 500 });
  }
}
