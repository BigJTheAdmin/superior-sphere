// Lightweight RTT/Upload endpoint for the NOC page.
// - GET/HEAD: quick 204 (used for RTT)
// - POST: read & discard body, then 204 (used for upload speed)

export async function GET() {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function HEAD() {
  return GET();
}

export async function POST({ request }: { request: Request }) {
  // Read and discard the body to simulate an upload sink.
  try {
    // If body is a stream, drain it
    const reader = request.body?.getReader();
    if (reader) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } else {
      // If not a stream (rare), still await text/arrayBuffer to consume
      await request.arrayBuffer().catch(() => {});
    }
  } catch {
    // ignore read errors; we still respond 204
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
