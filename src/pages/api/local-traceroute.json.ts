export const prerender = true;
import { runTrace } from "@/lib/traceRelay";

async function onRunTraceroute(target: string) {
  const res = await runTrace(target);
  if (!res.ok || !res.hops) {
    alert("Traceroute failed: " + (res.error || "unknown"));
    return;
  }
  // res.hops -> draw on your map (use hop.geo?.lat/lon)
}
