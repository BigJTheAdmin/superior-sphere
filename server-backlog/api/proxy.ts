// /src/pages/api/proxy.ts
// Proxies allowed requests to ping.ashburn.win to bypass browser CORS.
// Usage from the browser:  /api/proxy?path=/b   or  /api/proxy?path=/download
// You can extend ALLOWED_PATHS if you need more.

const ORIGIN_HOST = "ping.ashburn.win";
const ALLOWED_PATHS = new Set([
  "/b",          // baseline / bundle / summary (used by some examples)
  "/latency",    // latency-only endpoint (if exposed by the remote)
  "/download",   // download test
  "/upload",     // upload test
  "/packet"      // packet-loss
]);

export async function GET({ url }: { url: URL }) {
  try {
    const path = url.searchParams.get("path") || "/b";

    if (!ALLOWED_PATHS.has(path)) {
      return new Response(JSON.stringify({ error: "Path not allowed", path }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const target = new URL(`https://${ORIGIN_HOST}${path}`);
    // Add a cache-buster so the remote doesn’t serve a stale response
    target.searchParams.set("nocache", String(Date.now()));

    const upstream = await fetch(target.toString(), {
      // Pass-through method/headers if needed later; keep it simple for GET
      headers: {
        "User-Agent": "PingTraceSSH-Proxy/1.0",
        "Accept": "application/json, text/plain, */*"
      },
      // A short timeout behavior (Astro/Node doesn’t have native timeout; rely on remote)
      cache: "no-store"
    });

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        // IMPORTANT: we do NOT set Access-Control-Allow-Origin here because
        // the browser calls OUR domain (same-origin). No CORS needed.
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Proxy error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}
