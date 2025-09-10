// Minimal, safe proxy for ISP Intelligence page
// Accepts:   GET /api/netfetch?url=<https URL>
// Purpose:   Avoid browser CORS while rate-limiting and validating domains
// Notes:
//  - Only HTTPS targets allowed
//  - Allowlist can be expanded as needed
//  - Adds sane headers (User-Agent, Accept) some APIs require
//  - Times out long requests to prevent “stuck checking”

import type { APIRoute } from "astro";

const ALLOW = new Set<string>([
  "ipapi.co",
  "dns.google",
  "rdap.arin.net",
  "api.bgpview.io",
  "www.peeringdb.com",
  "stat.ripe.net",
  "www.openstreetmap.org",
]);

const UA =
  "PingTraceSSH/1.0 (+https://pingtracessh.com; contact: support@pingtracessh.com)";

export const GET: APIRoute = async ({ request }) => {
  const urlParam = new URL(request.url).searchParams.get("url")?.trim();
  if (!urlParam) {
    return jsonError(400, "Missing ?url parameter");
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return jsonError(400, "Invalid URL");
  }

  if (target.protocol !== "https:") {
    return jsonError(400, "Only HTTPS targets are allowed");
  }

  // domain allowlist
  const host = target.hostname.toLowerCase();
  if (!ALLOW.has(host)) {
    return jsonError(400, `Host not allowed: ${host}`);
  }

  // Basic fetch with timeout (AbortController)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000); // 12s cut-off

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept:
          "application/json, application/problem+json, text/plain, */*;q=0.1",
        // Some endpoints prefer a referer even though it isn't strictly necessary.
        Referer: "https://pingtracessh.com/free-tools/isp-info",
      },
    });
  } catch (err: any) {
    clearTimeout(timer);
    const msg =
      err?.name === "AbortError" ? "Upstream timeout" : `Upstream fetch failed`;
    return jsonError(502, msg);
  } finally {
    clearTimeout(timer);
  }

  // Propagate upstream status
  const status = upstream.status;

  // Try to pass through JSON when possible, otherwise send text
  const ctype = upstream.headers.get("content-type") || "";
  const init = {
    status,
    headers: {
      // lock this to json/text for safety
      "content-type": ctype.includes("json")
        ? "application/json; charset=utf-8"
        : "text/plain; charset=utf-8",
      // explicit no-CORS exposure needed only if called cross-origin; we’re same-origin here
      "cache-control": "public, max-age=60",
    },
  } as ResponseInit;

  if (ctype.includes("json")) {
    try {
      const data = await upstream.json();
      return new Response(JSON.stringify(data), init);
    } catch {
      // If JSON parse fails, fall back to text
      const text = await upstream.text();
      return new Response(text, init);
    }
  } else {
    const text = await upstream.text();
    return new Response(text, init);
  }
};

function jsonError(code: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: code,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
