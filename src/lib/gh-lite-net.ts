---
// src/components/NetworkDiagnostics.astro
import { pingEstimate, downloadMbps, packetLossPct, ipDiagnostics } from "@/lib/gh-lite-net";

const state = {
  ip: "Loading…",
  asn: "",
  loc: "",
  latency: "—",
  down: "—",
  loss: "—",
};

const run = async () => {
  const info = await ipDiagnostics();
  state.ip = info.ip ?? "Unknown";
  state.asn = info.asn ?? "";
  state.loc = [info.city, info.region, info.country].filter(Boolean).join(", ");

  const [rtt, down, loss] = await Promise.all([
    pingEstimate(3),
    downloadMbps(2.5),
    packetLossPct(12),
  ]);

  state.latency = String(rtt);
  state.down = String(down);
  state.loss = String(loss);
};

await run();
---

<section class="ndx">
  <div class="grid">
    <div class="info">
      <div><b>Public IP:</b> {state.ip}</div>
      {state.asn && <div><b>ASN:</b> {state.asn}</div>}
      {state.loc && <div><b>Location:</b> {state.loc}</div>}
      <div class="hint">* Browser-based estimates (GitHub Pages mode)</div>
    </div>

    <div class="meters">
      <div class="card">
        <div class="dial">
          <div class="dot" style={`--v:${Number(state.latency) || 0}`}></div>
        </div>
        <div class="label"><b>{state.latency}</b><span>ms</span></div>
        <div class="sub">Latency</div>
      </div>

      <div class="card">
        <div class="dial">
          <div class="dot" style={`--v:${Number(state.down) || 0}`}></div>
        </div>
        <div class="label"><b>{state.down}</b><span>Mb/s</span></div>
        <div class="sub">Download</div>
      </div>

      <div class="card">
        <div class="dial red">
          <div class="dot" style={`--v:${Number(state.loss) || 0}`}></div>
        </div>
        <div class="label"><b>{state.loss}</b><span>%</span></div>
        <div class="sub">Packet Loss</div>
      </div>
    </div>
  </div>

  <details class="note">
    <summary>Why these numbers?</summary>
    <p>
      GitHub Pages is static hosting, so we estimate RTT, throughput, and loss using CORS-friendly HTTP requests.
      When you later move your API to Workers/VPS, you can switch this component back to real server tests.
    </p>
  </details>
</section>

<style>
  .ndx { padding: 8px 0; }
  .grid {
    display: grid; gap: 12px;
    grid-template-columns: 1fr;
  }
  .info {
    background: #0c7c3a20;
    border: 1px solid #17724555;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 0.95rem;
  }
  .info .hint { opacity: .8; font-size: .85rem; margin-top: 4px; }

  .meters {
    display: grid; gap: 12px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (max-width: 720px){
    .meters { grid-template-columns: 1fr; }
  }

  .card {
    background: #151515;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 12px;
    text-align: center;
  }
  .dial {
    width: 120px; height: 120px; margin: 4px auto 8px; position: relative;
    border-radius: 12px; background: #1e1e1e; border: 1px solid #2f2f2f;
    box-shadow: inset 0 0 0 3px #2a2a2a;
  }
  .dial .dot {
    --v: 0; /* 0..100-ish */
    position: absolute; left: 50%; top: 50%;
    width: 6px; height: 6px; border-radius: 50%;
    background: #22d3ee; transform-origin: -45px 0;
    transform: rotate(calc((min(var(--v),100) / 100) * 270deg - 135deg)) translateX(45px);
    box-shadow: 0 0 0 3px #0a0a0a, 0 0 8px rgba(34,211,238,.7);
  }
  .dial.red .dot { background: #ef4444; box-shadow: 0 0 0 3px #0a0a0a, 0 0 8px rgba(239,68,68,.7); }
  .label { font-size: 1.05rem; }
  .label span { opacity: .75; margin-left: 4px; font-size: .9rem; }
  .sub { opacity: .7; font-size: .85rem; margin-top: 2px; }
  .note { margin-top: 8px; }
</style>
