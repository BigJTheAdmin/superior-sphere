/// <reference types="astro/client" />
import React, { useEffect, useState } from "react";

type Probe = {
  name: string;
  family: string;
  url: string;
  method: string;
  ok: boolean;
  status: number;
  statusText: string;
  ms: number;
  contentType: string | null;
  checkedAt: string;
};

type Payload = {
  version: number;
  generatedAt: string;
  services: Probe[];
};

function isJsonLike(ct: string | null) {
  return !!ct && ct.toLowerCase().includes("application/json");
}

export default function StatusTicker() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/ping-services.json", { cache: "no-store" });
        const ct = res.headers.get("content-type");
        const raw = await res.text();

        let json: Payload;
        try {
          json = JSON.parse(raw);
        } catch (e) {
          // Provide a good error with first 120 chars for debugging.
          throw new Error(
            `Invalid JSON from /ping-services.json (ct=${ct ?? "none"}): ` +
              raw.slice(0, 120)
          );
        }

        if (!Array.isArray(json.services)) {
          throw new Error("Malformed JSON: 'services' is not an array.");
        }

        setData(json);
        setErr(null);
      } catch (e: any) {
        console.warn("[StatusTicker] load failed:", e);
        setErr(e?.message ?? String(e));
      }
    })();
  }, []);

  if (err) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
        <strong>Status Ticker Error:</strong> {err}
      </div>
    );
  }

  if (!data) {
    return <div className="text-xs opacity-70">Loading status…</div>;
  }

  const items = data.services
    .slice()
    .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((p) => (
        <a
          key={p.name}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className={[
            "rounded px-2 py-1 text-xs no-underline",
            p.ok ? "bg-green-600/20 text-green-200 hover:bg-green-600/30" : "bg-red-600/20 text-red-200 hover:bg-red-600/30",
          ].join(" ")}
          title={`${p.status} ${p.statusText} • ${p.ms}ms • ${p.contentType ?? "unknown"}`}
        >
          {p.family}: {p.name} {p.ok ? "✓" : "×"}
        </a>
      ))}
    </div>
  );
}
