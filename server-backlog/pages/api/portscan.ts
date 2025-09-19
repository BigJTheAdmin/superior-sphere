import type { APIRoute } from "astro";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns/promises";

type ScanReq = {
  host: string;
  ports: number[] | string;
  timeout?: number;
  concurrency?: number;
  dnsFirst?: boolean;
  tlsProbe?: boolean;
  bannerGrab?: boolean;
};

const HTTPS_LIKE = new Set([443, 8443, 9443, 993, 995, 587, 465, 444, 5443, 10443]);
const MAX_PORTS = 2000;
const MAX_TIMEOUT = 10000;

export const GET: APIRoute = async ({ url }) => {
  // GET handler (query string)
  const q = url.searchParams;
  const data: ScanReq = {
    host: q.get("host") || "",
    ports: q.get("ports") || "",
    timeout: +(q.get("timeout") || 1200),
    concurrency: +(q.get("concurrency") || 40),
    dnsFirst: q.get("dnsFirst") === "1",
    tlsProbe: q.get("tlsProbe") === "1",
    bannerGrab: q.get("bannerGrab") === "1",
  };
  return runScan(data);
};

export const POST: APIRoute = async ({ request, url }) => {
  // Accept JSON body, form body, or fallback to query string
  const body = await readAnyBody(request, url);
  if (!body.ok) return jerr(400, "invalid request body", body.debug);
  return runScan(body.data as ScanReq);
};

// ---------- core ----------
async function runScan(input: ScanReq): Promise<Response> {
  try {
    const host = (input.host || "").trim();
    if (!host) return jerr(400, "host required");

    let ports: number[] = [];
    if (Array.isArray(input.ports)) ports = input.ports.map((n) => (n | 0));
    else if (typeof input.ports === "string") ports = expandPorts(input.ports);
    ports = ports.filter((n) => n >= 1 && n <= 65535);
    if (!ports.length) return jerr(400, "no ports");
    if (ports.length > MAX_PORTS) return jerr(400, "too many ports");

    const timeout = clamp(input.timeout ?? 1200, 200, MAX_TIMEOUT);
    const concurrency = clamp(input.concurrency ?? 40, 1, 100);
    const dnsFirst = !!input.dnsFirst;
    const tlsProbe = !!input.tlsProbe;
    const bannerGrab = !!input.bannerGrab;

    let ip = host, ptr: string | undefined;
    if (dnsFirst || !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      try { ip = (await dns.lookup(host)).address; }
      catch (e) { return jerr(400, `DNS lookup failed for '${host}'`, errInfo(e)); }
    }
    try { const ptrs = await dns.reverse(ip); if (ptrs?.length) ptr = ptrs[0]; } catch {}

    const guess = (p: number) =>
      ({20:"FTP-DATA",21:"FTP",22:"SSH",23:"Telnet",25:"SMTP",53:"DNS",80:"HTTP",110:"POP3",143:"IMAP",
        443:"HTTPS",445:"SMB",465:"SMTPS",587:"Submission",993:"IMAPS",995:"POP3S",3306:"MySQL",
        3389:"RDP",5432:"Postgres",5900:"VNC",6379:"Redis",8080:"HTTP-Alt",8443:"HTTPS-Alt",9443:"HTTPS-Alt"} as Record<number,string>)[p] || "";

    const queue = ports.slice();
    const results: any[] = [];
    const tlsList: any[] = [];
    const workers = Array.from({ length: concurrency }, () => worker());

    async function worker() {
      for (;;) {
        const port = queue.shift();
        if (port == null) break;
        try {
          const r = await scanPort(ip, port, { timeout, bannerGrab });
          r.service ||= guess(port);
          results.push(r);
          if (tlsProbe && r.status === "open" && HTTPS_LIKE.has(port)) {
            const cert = await probeTLS(ip, port, timeout).catch(() => null);
            if (cert) tlsList.push({ port, ...cert });
          }
        } catch (e) {
          results.push({ port, status: "closed", error: String((e as any)?.message || e) });
        }
      }
    }

    await Promise.all(workers);

    return json({ pre: { host, ip, ptr }, results: results.sort((a, b) => a.port - b.port), tls: tlsList.sort((a, b) => a.port - b.port) });
  } catch (e) {
    return jerr(500, "server error", errInfo(e));
  }
}

// ---------- helpers ----------
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n | 0)); }
function expandPorts(raw: string): number[] {
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const set = new Set<number>();
  for (const p of parts) {
    if (/^\d+$/.test(p)) { const n = +p; if (n >= 1 && n <= 65535) set.add(n); }
    else {
      const m = p.match(/^(\d+)-(\d+)$/);
      if (m) { let a = +m[1] | 0, b = +m[2] | 0; if (b < a) [a, b] = [b, a]; a = clamp(a, 1, 65535); b = clamp(b, 1, 65535); for (let n = a; n <= b; n++) set.add(n); }
    }
  }
  return [...set].sort((x, y) => x - y);
}
function errInfo(e: any) { return e && typeof e === "object" ? { name: e.name, code: (e as any).code, message: String(e.message || e) } : { message: String(e) }; }
function json(data: any, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
function jerr(status: number, message: string, details?: any): Response { return json({ error: message, details }, status); }

async function readAnyBody(req: Request, url: URL): Promise<{ ok: true; data: Record<string, any> } | { ok: false; debug: Record<string, any> }> {
  const debug: Record<string, any> = { contentType: req.headers.get("content-type") || null };
  try {
    const raw = await req.text();
    debug.rawLen = raw.length;
    if (raw.length) {
      try { return { ok: true, data: JSON.parse(raw) }; }
      catch (e: any) { debug.jsonError = e?.message || String(e); }
    }
  } catch (e: any) { debug.readTextError = e?.message || String(e); }

  try {
    const form = await req.formData();
    if (form && Array.from(form.keys()).length) {
      const obj: Record<string, any> = {};
      form.forEach((v, k) => (obj[k] = typeof v === "string" ? v : undefined));
      return { ok: true, data: obj };
    }
  } catch (e: any) { debug.formError = e?.message || String(e); }

  const q = url.searchParams;
  if (q.has("host") || q.has("ports")) {
    const obj: Record<string, any> = {};
    q.forEach((v, k) => (obj[k] = v));
    return { ok: true, data: obj };
  }
  return { ok: false, debug };
}

function scanPort(ip: string, port: number, opt: { timeout: number; bannerGrab: boolean }): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now();
    const s = new net.Socket();
    let settled = false, banner = "";
    const finalize = (status: "open" | "closed" | "timeout") => { if (settled) return; settled = true; try { s.destroy(); } catch {} ; resolve({ port, status, rtt: status === "open" ? Date.now() - start : undefined, banner }); };
    s.setTimeout(opt.timeout, () => finalize("timeout"));
    s.once("error", () => finalize("closed"));
    s.once("close", () => { if (!settled) finalize("closed"); });
    s.connect(port, ip, () => {
      if (!opt.bannerGrab) return finalize("open");
      let grabbed = false;
      s.once("data", (buf) => { if (grabbed) return; grabbed = true; banner = safeSlice(buf.toString("utf8"), 512); finalize("open"); });
      if ([80, 8080, 8000, 8888, 8443, 8880].includes(port)) {
        try { s.write(`HEAD / HTTP/1.1\r\nHost: ${ip}\r\nConnection: close\r\n\r\n`); setTimeout(() => { if (!grabbed) finalize("open"); }, 120); }
        catch { finalize("open"); }
      } else {
        setTimeout(() => { if (!grabbed) finalize("open"); }, 180);
      }
    });
  });
}
function probeTLS(ip: string, port: number, timeout: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host: ip, port, servername: ip, rejectUnauthorized: false, ALPNProtocols: ["h2", "http/1.1"] }, () => {
      const c = sock.getPeerCertificate?.(); const proto = sock.getProtocol?.(); const alpn = (sock as any).alpnProtocol || proto;
      const san = typeof (c as any)?.subjectaltname === "string" ? (c as any).subjectaltname.replace(/^DNS:/, "").split(/,\s*DNS:/g) : [];
      const out = { subjectCN: (c as any)?.subject?.CN || (c as any)?.subject?.commonName || "", issuer: (c as any)?.issuerCertificate?.subject?.CN || (c as any)?.issuer?.CN || "", valid_from: (c as any)?.valid_from || "", valid_to: (c as any)?.valid_to || "", san, protocol: proto || "", alpn: alpn || "" };
      try { sock.destroy(); } catch {} ; resolve(out);
    });
    sock.setTimeout(timeout, () => { try { sock.destroy(); } catch {} ; reject(new Error("tls timeout")); });
    sock.once("error", (e) => { try { sock.destroy(); } catch {} ; reject(e); });
  });
}
function safeSlice(s: string, n: number) { return s && s.length > n ? s.slice(0, n) : (s || ""); }
