// src/data/pages.search.ts

/**
 * QUICK, RELIABLE PAGE SEARCH INDEX
 * ---------------------------------
 * This is the "source of truth" for search—for now.
 * Add/adjust entries as you add pages. No blog docs needed.
 *
 * title:      Text shown in search results
 * url:        Exact route on your site
 * description:Short blurb for context (also searched)
 * keywords:   Extra terms to match (optional)
 */

export type PageDoc = {
  title: string;
  url: string;
  description?: string;
  keywords?: string[];
};

export const PAGES: PageDoc[] = [
  {
    title: "Home — PingTraceSSH",
    url: "/",
    description: "Ping • Trace • Fix • Repeat. Network diagnostics, toolkits, and IT humor.",
    keywords: ["ping", "trace", "fix", "repeat", "network", "diagnostics"],
  },
  {
    title: "Free Tools",
    url: "/free-tools/",
    description: "DNS checker, IP tools, calculators, and troubleshooting utilities.",
    keywords: ["dns", "whois", "subnet", "calculator", "ip tools", "troubleshoot"],
  },
  {
    title: "Job Search",
    url: "/job-search/",
    description: "Find network engineering roles with filters, featured posts, and local search.",
    keywords: ["jobs", "careers", "network", "engineer", "featured"],
  },
  {
    title: "Breakroom",
    url: "/breakroom/",
    description: "Games like Corporate Chase, Help Desk Hero, and more IT-themed fun.",
    keywords: ["games", "corporate chase", "help desk hero", "breakroom"],
  },
  {
    title: "Pricing & Toolkits",
    url: "/pricing/",
    description: "Free, Pro, and Ultimate toolkits. One-time licenses and monthly plans.",
    keywords: ["pricing", "toolkits", "pro", "ultimate", "license"],
  },
  {
    title: "Raise Planner",
    url: "/raise-planner/",
    description: "Plan and negotiate your next raise with data-backed scripts and timelines.",
    keywords: ["salary", "raise", "negotiation", "planner"],
  },
  {
    title: "DNS Checker",
    url: "/tools/dns-checker/",
    description: "Look up A, AAAA, CNAME, MX, TXT, NS, and SOA records quickly.",
    keywords: ["dns", "records", "mx", "txt", "ns", "a", "aaaa"],
  },
  {
    title: "Port Scanner",
    url: "/tools/port-scan/",
    description: "Fast port scan with presets and export.",
    keywords: ["port scan", "nmap", "zenmap", "tcp", "udp"],
  },
  {
    title: "Contact",
    url: "/contact/",
    description: "Get in touch for support, partnerships, or enterprise inquiries.",
    keywords: ["contact", "support"],
  },
  {
    title: "About",
    url: "/about/",
    description: "The PingTraceSSH story, mission, and roadmap.",
    keywords: ["about", "mission", "roadmap"],
  },
  // Add more entries as needed…
];
