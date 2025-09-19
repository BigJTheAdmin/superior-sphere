// Same-origin download generator for the NOC page.
// Usage: /api/down?bytes=1048576  (default 1 MiB)

function toInt(v: string | null, def: number) {
  const n = v ? parseInt(v, 10) : def;
  return Number.isFinite(n) && n > 0 ? n : def;
}

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const totalBytes = toInt(url.searchParams.get("bytes"), 1 * 1024 * 1024); // default 1MiB

  const chunkSize = 64 * 1024; // 64 KiB
  const chunks = Math.ceil(totalBytes / chunkSize);

  const stream = new ReadableStream({
    start(controller) {
      // Reuse a zeroed buffer so we don't allocate per-chunk.
      const buf = new Uint8Array(chunkSize);
      let sent = 0;
      for (let i = 0; i < chunks; i++) {
        const remaining = totalBytes - sent;
        if (remaining <= 0) break;
        const view = remaining >= chunkSize ? buf : buf.subarray(0, remaining);
        controller.enqueue(view);
        sent += view.length;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
