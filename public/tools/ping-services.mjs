// Node 20+ (global fetch available)
// Usage: node tools/ping-services.mjs
// Writes: public/ping-services.json

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public");
const OUT_FILE = resolve(OUT_DIR, "ping-services.json");

const CONCURRENCY = 8;
const TIMEOUT_MS = 8000;

/** Minimal list to start; add/remove safely. */
const SERVICES = [
  // --- Cloud
  { name: "AWS Global Status", family: "Cloud", url: "https://status.aws.amazon.com/data.json", method: "GET" },
  { name: "Azure Global Status (RSS)", family: "Cloud", url: "https://status.azure.com/en-us/status/feed/", method: "GET" },
  { name: "Google Cloud Incidents", family: "Cloud", url: "https://status.cloud.google.com/incidents.json", method: "GET" },
  { name: "Oracle Cloud (OCI)", family: "Cloud", url: "https://ocistatus.oraclecloud.com/api/v2/incidents", method: "GET" },

  // --- Networking
  { name: "Cloudflare Status", family: "Networking", url: "https://www.cloudflarestatus.com/history.rss", method: "GET" },
  { name: "Fastly Status", family: "Networking", url: "https://status.fastly.com/history.rss", method: "GET" },
  { name: "Akamai Status", family: "Networking", url: "https://www.akamai.com/site/en/documents/akamai-status.rss.xml", method: "GET" },

  // --- Dev Platforms
  { name: "GitHub Status", family: "Dev", url: "https://www.githubstatus.com/api/v2/summary.json", method: "GET" },
  { name: "GitLab Status", family: "Dev", url: "https://status.gitlab.com/pages/5b36dc6502d06804c08349f7/history.rss", method: "GET" },
  { name: "Atlassian Status", family: "Dev", url: "https://status.atlassian.com/history.atom", method: "GET" },

  // --- Communication
  { name: "Slack Status", family: "Comm", url: "https://status.slack.com/api/v2.0.0/current", method: "GET" },
  { name: "Zoom Status", family: "Comm", url: "https://status.zoom.us/history.rss", method: "GET" },
];

function timeout(ms) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
}

async function probe(svc) {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await Promise.race([
      fetch(svc.url, { method: svc.method ?? "GET", redirect: "follow", signal: ctrl.signal }),
      timeout(TIMEOUT_MS),
    ]);
    clearTimeout(t);

    // Some endpoints are RSS/Atom or HTML. We don't parse contents here.
    const ok = !!res && (res.ok || (res.status >= 200 && res.status < 400));
    return {
      name: svc.name,
      family: svc.family,
      url: svc.url,
      method: svc.method ?? "GET",
      ok,
      status: res?.status ?? 0,
      statusText: res?.statusText ?? "NO_RESPONSE",
      ms: Date.now() - started,
      contentType: res?.headers?.get("content-type") ?? null,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(t);
    return {
      name: svc.name,
      family: svc.family,
      url: svc.url,
      method: svc.method ?? "GET",
      ok: false,
      status: 0,
      statusText: (err && err.message) || "ERROR",
      ms: Date.now() - started,
      contentType: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  // bounded concurrency
  const results = [];
  let i = 0;
  async function worker() {
    while (i < SERVICES.length) {
      const idx = i++;
      results[idx] = await probe(SERVICES[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, SERVICES.length) }, worker));

  // Always write valid JSON array
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    services: results,
  };
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${OUT_FILE} with ${results.length} services.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
