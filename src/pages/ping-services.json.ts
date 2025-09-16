// src/pages/ping-services.json.ts
// NOTE: This is a *static* build-time endpoint for GitHub Pages.
// Astro will prerender this to /ping-services.json (no server needed).

export const prerender = true;

// Types
type Method = "HEAD" | "GET";
type Family =
  | "Cloud"
  | "CDN/DNS"
  | "Identity & MFA"
  | "Collaboration"
  | "Dev Platforms"
  | "Observability"
  | "ITSM"
  | "Security"
  | "Networking";

type Service = {
  name: string;
  url: string;
  family: Family;
  method?: Method;
  notes?: string;
  requiresAuth?: boolean;
};

// ===== services to probe at build time =====
const SERVICES: Service[] = [
  // Cloud
  { name: "AWS Global Status", family: "Cloud", url: "https://status.aws.amazon.com/data.json", method: "GET" },
  { name: "Azure Global Status (RSS)", family: "Cloud", url: "https://status.azure.com/en-us/status/feed/", method: "GET" },
  { name: "Google Cloud (Incidents)", family: "Cloud", url: "https://status.cloud.google.com/incidents.json", method: "GET" },
  { name: "Oracle Cloud (OCI)", family: "Cloud", url: "https://ocistatus.oraclecloud.com/api/v2/status.json", method: "GET" },
  { name: "VMware Cloud Services", family: "Cloud", url: "https://status.vmware-services.io/api/v2/summary.json", method: "GET" },
  { name: "Snowflake", family: "Cloud", url: "https://status.snowflake.com/api/v2/summary.json", method: "GET" },

  // CDN / DNS
  { name: "Cloudflare", family: "CDN/DNS", url: "https://www.cloudflarestatus.com/api/v2/summary.json", method: "GET" },
  { name: "Akamai", family: "CDN/DNS", url: "https://www.akamaistatus.com/api/v2/summary.json", method: "GET" },
  { name: "Fastly", family: "CDN/DNS", url: "https://status.fastly.com/api/v2/summary.json", method: "GET" },
  { name: "Google Public DNS (Resolver)", family: "CDN/DNS", url: "https://dns.google/resolve?name=google.com&type=A", method: "GET" },

  // Identity / MFA
  { name: "Okta", family: "Identity & MFA", url: "https://status.okta.com/api/v2/summary.json", method: "GET" },
  { name: "Duo Security", family: "Identity & MFA", url: "https://status.duo.com/api/v2/summary.json", method: "GET" },
  { name: "Ping Identity", family: "Identity & MFA", url: "https://status.pingidentity.com/api/v2/summary.json", method: "GET" },
  { name: "Auth0", family: "Identity & MFA", url: "https://status.auth0.com/api/v2/summary.json", method: "GET" },
  { name: "OneLogin", family: "Identity & MFA", url: "https://status.onelogin.com/api/v2/summary.json", method: "GET" },
  { name: "Azure AD (OIDC Config)", family: "Identity & MFA", url: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration", method: "GET", notes: "Public config up check" },

  // Collaboration / Productivity
  { name: "Microsoft 365 (Global)", family: "Collaboration", url: "https://status.office.com/api/v2/status", method: "GET", notes: "Public global rollup (tenant health requires auth)" },
  { name: "Microsoft Teams Web Client", family: "Collaboration", url: "https://teams.microsoft.com/health", method: "GET", notes: "Simple reachability check" },
  { name: "Slack", family: "Collaboration", url: "https://status.slack.com/api/v2.0.0/current", method: "GET" },
  { name: "Zoom", family: "Collaboration", url: "https://status.zoom.us/api/v2/summary.json", method: "GET" },
  { name: "Webex", family: "Collaboration", url: "https://status.webex.com/index.json", method: "GET" },
  { name: "Google Workspace (Incidents)", family: "Collaboration", url: "https://www.google.com/appsstatus/dashboard/incidents.json", method: "GET" },
  { name: "Atlassian Cloud (Jira/Confluence)", family: "Collaboration", url: "https://status.atlassian.com/api/v2/summary.json", method: "GET" },
  { name: "Dropbox", family: "Collaboration", url: "https://status.dropbox.com/api/v2/summary.json", method: "GET" },
  { name: "Box", family: "Collaboration", url: "https://status.box.com/api/v2/summary.json", method: "GET" },
  { name: "Workday", family: "Collaboration", url: "https://wdstatus.com/api/v2/summary.json", method: "GET" },
  { name: "Salesforce", family: "Collaboration", url: "https://status.salesforce.com/api/v2/summary.json", method: "GET" },

  // Dev Platforms / CI-CD
  { name: "GitHub", family: "Dev Platforms", url: "https://www.githubstatus.com/api/v2/summary.json", method: "GET" },
  { name: "GitLab", family: "Dev Platforms", url: "https://status.gitlab.com/api/v2/summary.json", method: "GET" },
  { name: "Bitbucket (Atlassian)", family: "Dev Platforms", url: "https://bitbucket.status.atlassian.com/api/v2/summary.json", method: "GET" },
  { name: "CircleCI", family: "Dev Platforms", url: "https://status.circleci.com/api/v2/summary.json", method: "GET" },
  { name: "Azure DevOps (Health)", family: "Dev Platforms", url: "https://status.dev.azure.com/_apis/status/health?api-version=7.1-preview.1", method: "GET" },
  { name: "HashiCorp Cloud (Terraform Cloud)", family: "Dev Platforms", url: "https://status.hashicorp.com/api/v2/summary.json", method: "GET" },

  // Observability / APM / Alerting
  { name: "Datadog", family: "Observability", url: "https://status.datadoghq.com/api/v2/summary.json", method: "GET" },
  { name: "New Relic", family: "Observability", url: "https://status.newrelic.com/api/v2/summary.json", method: "GET" },
  { name: "PagerDuty", family: "Observability", url: "https://status.pagerduty.com/api/v2/summary.json", method: "GET" },
  { name: "Splunk Cloud", family: "Observability", url: "https://status.splunk.com/api/v2/summary.json", method: "GET" },
  { name: "Elastic Cloud", family: "Observability", url: "https://status.elastic.co/api/v2/summary.json", method: "GET" },
  { name: "Sumo Logic", family: "Observability", url: "https://status.sumologic.com/api/v2/summary.json", method: "GET" },
  { name: "AppDynamics", family: "Observability", url: "https://status.appdynamics.com/api/v2/summary.json", method: "GET" },

  // ITSM / Support Ops
  { name: "ServiceNow", family: "ITSM", url: "https://status.servicenow.com/api/v2/summary.json", method: "GET" },
  { name: "Zendesk", family: "ITSM", url: "https://status.zendesk.com/api/v2/summary.json", method: "GET" },
  { name: "Opsgenie", family: "ITSM", url: "https://status.opsgenie.com/api/v2/summary.json", method: "GET" },

  // Security
  { name: "Palo Alto Networks Cloud Services", family: "Security", url: "https://status.paloaltonetworks.com/api/v2/summary.json", method: "GET" },
  { name: "Zscaler", family: "Security", url: "https://status.zscaler.com/api/v2/summary.json", method: "GET" },
  { name: "Mimecast", family: "Security", url: "https://status.mimecast.com/api/v2/summary.json", method: "GET" },
  { name: "Proofpoint", family: "Security", url: "https://status.proofpoint.com/api/v2/summary.json", method: "GET" },
  { name: "Okta Workforce Identity", family: "Security", url: "https://status.okta.com/api/v2/summary.json", method: "GET" },
  { name: "SentinelOne (Status)", family: "Security", url: "https://status.sentinelone.com/api/v2/summary.json", method: "GET" },
  { name: "CrowdStrike (Status)", family: "Security", url: "https://status.crowdstrike.com/api/v2/summary.json", method: "GET" },
  { name: "Netskope (Status)", family: "Security", url: "https://status.netskope.com/api/v2/summary.json", method: "GET" },

  // Networking
  { name: "Cisco Meraki", family: "Networking", url: "https://status.meraki.com/api/v2/summary.json", method: "GET" },
  { name: "Juniper Mist", family: "Networking", url: "https://status.mist.com/api/v2/summary.json", method: "GET" },
  { name: "Aruba Central", family: "Networking", url: "https://status.arubanetworks.com/api/v2/summary.json", method: "GET" },
];

const CONCURRENCY = 8;
const TIMEOUT_MS = 7000;

// Build-time fetch with timeout; runs in Node during `astro build`.
async function probe(url: string, method: Method = "GET", timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      "User-Agent": "PingTraceSSH-StatusBot/1.0 (+https://PingTraceSSH.com)",
      "Accept": url.includes("dns.google")
        ? "application/dns-json"
        : "application/json,text/xml,application/rss+xml,*/*",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    };
    let res = await fetch(url, { method, redirect: "manual", signal: ctrl.signal, headers });
    if ((res.status === 405 || res.status === 501) && method === "HEAD") {
      res = await fetch(url, { method: "GET", redirect: "manual", signal: ctrl.signal, headers });
    }
    const up = res.ok || (res.status >= 200 && res.status < 400);
    return { up, status: res.status || 0, reason: up ? undefined : `http_${res.status}` };
  } catch (e: any) {
    return { up: false, status: 0, reason: e?.name || "error" };
  } finally {
    clearTimeout(timer);
  }
}

// Simple concurrency limiter
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let idx = 0;
  async function worker() {
    for (;;) {
      const i = idx++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = err as any;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

export async function GET() {
  const startedAt = Date.now();

  const results = await mapWithLimit(SERVICES, CONCURRENCY, async (s) => {
    if (s.requiresAuth) {
      return { name: s.name, family: s.family, url: s.url, up: false, status: 0, reason: "requires_auth" };
    }
    const r = await probe(s.url, s.method ?? "GET");
    return { name: s.name, family: s.family, url: s.url, notes: s.notes, ...r };
  });

  results.sort((a: any, b: any) => (a.family === b.family ? a.name.localeCompare(b.name) : a.family.localeCompare(b.family)));

  const body = {
    updatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    count: results.length,
    results,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "access-control-allow-origin": "*", // harmless on static
    },
    status: 200,
  });
}
