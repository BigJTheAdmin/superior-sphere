import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";

const DB_PATH = process.env.PTS_REPORT_DB || path.join(process.cwd(), "pts-reports.json");

type Report = {
  ts: number;           // epoch ms
  lat: number;
  lon: number;
  severity?: number;    // 1..5
  type?: string;
  isp?: string;
  notes?: string;
};

// Read DB (create if missing)
async function readDB(): Promise<Report[]> {
  try {
    const buf = await fs.readFile(DB_PATH, "utf8");
    const arr = JSON.parse(buf);
    return Array.isArray(arr) ? arr : [];
  } catch {
    await fs.writeFile(DB_PATH, "[]", "utf8");
    return [];
  }
}

async function writeDB(reports: Report[]) {
  await fs.writeFile(DB_PATH, JSON.stringify(reports), "utf8");
}

// GET /api/reports.json?window=6  (hours)
export const GET: APIRoute = async ({ url }) => {
  const hours = Math.max(1, Number(url.searchParams.get("window") ?? "6"));
  const since = Date.now() - hours * 60 * 60 * 1000;
  const all = await readDB();

  // Basic sanitization + filter by age
  const reports = all
    .filter(r => Number(r.ts) >= since && Number.isFinite(r.lat) && Number.isFinite(r.lon))
    .slice(-5000); // cap

  return new Response(JSON.stringify({ reports }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
};

// POST body: Report
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as Partial<Report>;
    const rec: Report = {
      ts: Number(body.ts) || Date.now(),
      lat: Number(body.lat),
      lon: Number(body.lon),
      severity: Math.max(1, Math.min(5, Number(body.severity) || 3)),
      type: (body.type || "unspecified").toString().slice(0, 40),
      isp: (body.isp || "Unknown ISP").toString().slice(0, 80),
      notes: (body.notes || "").toString().slice(0, 280)
    };

    if (!Number.isFinite(rec.lat) || !Number.isFinite(rec.lon)) {
      return new Response(JSON.stringify({ error: "invalid lat/lon" }), { status: 400 });
    }

    const all = await readDB();
    all.push(rec);
    await writeDB(all);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
  }
};
