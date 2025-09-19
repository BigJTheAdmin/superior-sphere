// src/scripts/isp-info.js
// Full drop-in client script for the ISP Intelligence page

import { safeFetchJSON } from "/src/lib/safeFetch.js";
import { enqueue } from "/src/lib/fetchQueue.js";

/* -----------------------------------------------------------
   Config (no inline <script> required)
   ----------------------------------------------------------- */
const cfgEl = document.getElementById("pts-config");
let PROXY = (cfgEl?.dataset?.proxy || window.__PTS_PROXY_URL || "")
  .trim()
  .replace(/\/+$/, ""); // remove trailing slashes

// Only these hosts must go through the proxy (CORS-blocked in browser)
const MUST_PROXY_HOSTS = new Set([
  "api.bgpview.io",
  "www.peeringdb.com",
  "peeringdb.com",
  "stat.ripe.net",
]);

/* -----------------------------------------------------------
   Small DOM helpers
   ----------------------------------------------------------- */
const byId = (id) => document.getElementById(id);
const setStatus = (msg) => (byId("status").textContent = msg);
const codeSpan = (s) => {
  const el = document.createElement("span");
  el.className = "mono";
  el.textContent = s;
  return el;
};
const tryVal = (fn, fb = "N/A") => {
  try {
    const r = fn();
    return r == null || r === "" ? fb : r;
  } catch {
    return fb;
  }
};
const ipToArpa = (ip) => {
  const p = ip.split(".");
  return p.length === 4 ? `${p.reverse().join(".")}.in-addr.arpa` : null;
};

/* -----------------------------------------------------------
   Fetch helpers: proxy + queue + JSON
   ----------------------------------------------------------- */
function maybeProxify(url) {
  const host = new URL(url).host;
  if (PROXY && MUST_PROXY_HOSTS.has(host)) {
    return `${PROXY}/proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}
function requireProxyOrExplain(url) {
  const host = new URL(url).host;
  if (MUST_PROXY_HOSTS.has(host) && !PROXY) {
    const msg = `This endpoint (${host}) blocks browser requests (CORS). Set PUBLIC_PROXY_URL in .env/.env.production or use the Cloudflare Worker proxy.`;
    setStatus(msg);
    throw new Error(msg);
  }
}

// Queue + safe JSON get (keeps parallelism sane and errors nice)
const qJSON = (url) =>
  enqueue(() => {
    requireProxyOrExplain(url);
    return safeFetchJSON(maybeProxify(url));
  });

/* -----------------------------------------------------------
   API calls
   ----------------------------------------------------------- */
async function getPublicIP() {
  return (await qJSON("https://api.ipify.org?format=json")).ip;
}
async function getGeo(ip) {
  return qJSON(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
}
async function getBGPForIP(ip) {
  return qJSON(`https://api.bgpview.io/ip/${encodeURIComponent(ip)}`);
}
async function getBGP_ASN(asn) {
  const base = `https://api.bgpview.io/asn/${asn}`;
  const [asnInfo, peers, prefixes, ix, ups, downs] = await Promise.all([
    qJSON(base),
    qJSON(`${base}/peers`),
    qJSON(`${base}/prefixes`),
    qJSON(`${base}/ixs`),
    qJSON(`${base}/upstreams`),
    qJSON(`${base}/downstreams`),
  ]);
  return { asnInfo, peers, prefixes, ix, ups, downs };
}
async function getPTR(ip) {
  const arpa = ipToArpa(ip);
  if (!arpa) return { Answer: [] };
  return qJSON(
    `https://dns.google/resolve?name=${encodeURIComponent(arpa)}&type=PTR`
  );
}
async function getRDAP_IP(ip) {
  return qJSON(`https://rdap.org/ip/${encodeURIComponent(ip)}`);
}
async function getRDAP_ASN(asn) {
  return qJSON(`https://rdap.org/autnum/${encodeURIComponent(asn)}`);
}
async function getPeeringDB(asn) {
  const net = await qJSON(
    `https://www.peeringdb.com/api/net?asn=${encodeURIComponent(asn)}`
  );
  const ixp = await qJSON(
    `https://www.peeringdb.com/api/netixlan?asn=${encodeURIComponent(asn)}`
  );
  const fac = await qJSON(
    `https://www.peeringdb.com/api/netfac?asn=${encodeURIComponent(asn)}`
  );
  return { net, ixp, fac };
}
async function getRIPAbuse(asn) {
  return qJSON(
    `https://stat.ripe.net/data/abuse-contact-finder/data.json?resource=AS${encodeURIComponent(
      asn
    )}`
  );
}

/* -----------------------------------------------------------
   Render helpers
   ----------------------------------------------------------- */
function kv(ul, items) {
  ul.innerHTML = "";
  for (const [k, v] of items) {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = k;
    li.appendChild(b);
    if (v instanceof HTMLElement) {
      li.appendChild(v);
    } else {
      const span = document.createElement("span");
      span.textContent = v ?? "N/A";
      li.appendChild(span);
    }
    ul.appendChild(li);
  }
}

/* -----------------------------------------------------------
   Renderers
   ----------------------------------------------------------- */
function renderKPIs({ ip, asn, org, country }) {
  byId("kpi-ip").textContent = ip || "—";
  byId("kpi-asn").textContent = asn ? `AS${asn}` : "—";
  byId("kpi-org").textContent = org || "—";
  byId("kpi-country").textContent = country || "—";
}

function renderIPCard(ip, geo, bgpIP) {
  const ul = byId("ip-list");
  const asnObj = tryVal(() => bgpIP.data.asns[0], {});
  kv(ul, [
    ["Public IP", codeSpan(ip)],
    ["City", tryVal(() => geo.city)],
    ["Region", tryVal(() => geo.region)],
    ["Country", tryVal(() => geo.country_name)],
    ["Org", tryVal(() => asnObj.name)],
    ["ASN", tryVal(() => `AS${asnObj.asn}`)],
    ["Prefix", tryVal(() => asnObj.prefix)],
    ["Registry", tryVal(() => asnObj.rir_name)],
  ]);

  const lat = tryVal(() => geo.latitude),
    lon = tryVal(() => geo.longitude);
  if (lat && lon) {
    const map = byId("loc-map");
    map.style.display = "block";
    map.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.03
      }%2C${lat - 0.02}%2C${lon + 0.03}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lon}" loading="lazy"></iframe>`;
  }
}

function renderPTR(ptr) {
  const ul = byId("ptr-list");
  const answers = tryVal(() => ptr.Answer, []);
  if (!answers.length) {
    kv(ul, [["PTR", "No PTR found"]]);
    return;
  }
  const values = answers
    .filter((a) => a.type === 12)
    .map((a) => a.data.replace(/\.$/, ""));
  kv(
    ul,
    values.map((v, i) => [`PTR ${i + 1}`, v])
  );
}

function renderRDAP_IP(rdap) {
  const owner = byId("rdap-owner"),
    events = byId("rdap-events");

  const handle = tryVal(() => rdap.handle);
  const name = tryVal(() => rdap.name || rdap.remarks?.[0]?.description?.[0]);
  const country = tryVal(() => rdap.country);

  owner.innerHTML = `<ul class="kv">
    <li><b>Handle</b><span>${handle}</span></li>
    <li><b>Name</b><span>${name}</span></li>
    <li><b>Country</b><span>${country}</span></li>
  </ul>`;

  const ev = tryVal(() => rdap.events, []);
  const evUL = document.createElement("ul");
  evUL.className = "kv";
  ev.forEach((e) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${e.eventAction}</b><span>${e.eventDate}</span>`;
    evUL.appendChild(li);
  });
  events.replaceChildren(evUL);

  const contacts = byId("rdap-contacts");
  const ents = tryVal(() => rdap.entities, []);
  const cUL = document.createElement("ul");
  cUL.className = "kv";
  ents.forEach((en) => {
    const role = tryVal(() => en.roles?.join(", "));
    const nm = tryVal(() => en.vcardArray?.[1]?.find((x) => x[0] === "fn")?.[3]);
    const email = tryVal(
      () =>
        en.vcardArray?.[1]?.find((x) => x[0] === "email")?.[3] ||
        en.entities?.[0]?.vcardArray?.[1]?.find((x) => x[0] === "email")?.[3]
    );
    cUL.innerHTML += `<li><b>${role || "Contact"}</b><span>${nm || ""} ${
      email ? "— " + email : ""
    }</span></li>`;
  });
  if (!ents.length) cUL.innerHTML = `<li><b>Contacts</b><span>Not listed</span></li>`;
  contacts.replaceChildren(cUL);
}

function renderBGP(asn, bgp) {
  const asnList = byId("bgp-asn-list");
  const data = tryVal(() => bgp.asnInfo.data, {});
  kv(asnList, [
    ["ASN", codeSpan(`AS${asn}`)],
    ["Name", tryVal(() => data.asn_name)],
    ["Country", tryVal(() => data.country_code)],
    ["Allocated", tryVal(() => data.date_allocated)],
    ["Prefixes (v4)", tryVal(() => data.ipv4_prefixes_count)],
    ["Prefixes (v6)", tryVal(() => data.ipv6_prefixes_count)],
  ]);

  const prefDiv = byId("bgp-prefixes");
  const v4 = tryVal(() => bgp.prefixes.data.ipv4_prefixes, []);
  const v6 = tryVal(() => bgp.prefixes.data.ipv6_prefixes, []);
  const mkList = (arr) =>
    `<ul class="kv">${arr
      .slice(0, 50)
      .map(
        (p) =>
          `<li><b>${p.ip || p.prefix}</b><span>${p.name || p.description || ""}</span></li>`
      )
      .join("")}</ul>`;
  prefDiv.innerHTML = `<h3>IPv4</h3>${mkList(v4)}<h3>IPv6</h3>${mkList(v6)}`;

  const peersUL = byId("bgp-peers"),
    upsUL = byId("bgp-upstreams"),
    downsUL = byId("bgp-downstreams");
  const peers = tryVal(() => bgp.peers.data.peers, []);
  const ups = tryVal(() => bgp.ups.data.upstreams, []);
  const downs = tryVal(() => bgp.downs.data.downstreams, []);
  kv(
    peersUL,
    peers.slice(0, 100).map((p) => [`AS${p.asn}`, p.name])
  );
  kv(
    upsUL,
    ups.slice(0, 50).map((p) => [`AS${p.asn}`, p.name])
  );
  kv(
    downsUL,
    downs.slice(0, 50).map((p) => [`AS${p.asn}`, p.name])
  );

  const ixUL = byId("bgp-ix");
  const ixs = tryVal(() => bgp.ix.data.ixs, []);
  kv(
    ixUL,
    ixs.slice(0, 100).map((ix) => [ix.name, `${ix.city || ""} ${ix.country || ""}`.trim()])
  );
}

function renderPDB(pdb) {
  // Net details
  const netUL = byId("pdb-net");
  const n = tryVal(() => pdb.net.data[0], {});
  kv(netUL, [
    ["Name", tryVal(() => n.name)],
    ["AKA", tryVal(() => n.aka)],
    ["Website", tryVal(() => n.website)],
    ["Policy URL", tryVal(() => n.policy_url)],
    ["IRR AS-SET", tryVal(() => n.irr_as_set)],
    ["ASN", tryVal(() => n.asn)],
    ["Notes", tryVal(() => n.notes)],
  ]);

  // IXP Ports
  const ixpUL = byId("pdb-ixp");
  const ixp = tryVal(() => pdb.ixp.data, []);
  kv(
    ixpUL,
    ixp.slice(0, 200).map((x, i) => [
      `Port ${i + 1}`,
      `${x.name || x.ixlan_id} — ${x.ipaddr4 || x.ipaddr6 || "N/A"} ${
        x.operational ? "(up)" : ""
      }`,
    ])
  );

  // Facilities
  const facUL = byId("pdb-fac");
  const fac = tryVal(() => pdb.fac.data, []);
  kv(
    facUL,
    fac.slice(0, 200).map((f) => [f.name, `${f.city || ""}, ${f.country || ""}`])
  );

  // Contacts / link out to PDB page
  const list = byId("pdb-list");
  list.innerHTML = "";
  const li = document.createElement("li");
  const id = n?.id || "";
  li.innerHTML = `<b>POC</b><span>See public POCs at: https://www.peeringdb.com/net/${id}</span>`;
  list.appendChild(li);
}

function renderRIPE(abuse) {
  const ul = byId("ripe-list");
  const contacts = tryVal(() => abuse.data?.abuse_contacts, []);
  if (!contacts.length) {
    kv(ul, [["Abuse", "Not published"]]);
    return;
  }
  kv(
    ul,
    contacts.map((c, i) => [`Abuse ${i + 1}`, c])
  );
}

function renderRDAP_ASN(rdap) {
  const ul = byId("rdap-asn");
  kv(ul, [
    ["Handle", tryVal(() => rdap.handle)],
    ["Name", tryVal(() => rdap.name)],
    ["Country", tryVal(() => rdap.country)],
    ["Start", tryVal(() => rdap.startAutnum)],
    ["End", tryVal(() => rdap.endAutnum)],
  ]);
}

function renderCustomerSupport(org, asn) {
  const el = byId("cs-card-content");
  const links = [
    ["BGPView", `https://bgpview.io/asn/${asn}`],
    ["PeeringDB", `https://www.peeringdb.com/asn/${asn}`],
    ["DownDetector", `https://downdetector.com/`],
    ["ASNTools", `https://asn.tools/as/${asn}`],
  ];
  el.innerHTML = `<ul class="kv">
    <li><b>Provider</b><span>${org || "N/A"}</span></li>
    ${links
      .map(
        ([n, u]) =>
          `<li><b>${n}</b><span><a href="${u}" target="_blank" rel="noopener">${u}</a></span></li>`
      )
      .join("")}
  </ul>`;
}

function renderClientCard(ip) {
  const ul = byId("client-card-content");
  kv(ul, [
    ["User Agent", navigator.userAgent],
    ["Platform", navigator.platform],
    ["Language", navigator.language],
    ["Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone],
    ["Online", String(navigator.onLine)],
    ["IP (observed)", ip],
  ]);
}

/* -----------------------------------------------------------
   Main
   ----------------------------------------------------------- */
(async function main() {
  try {
    setStatus("Initializing…");

    const ip = await getPublicIP();
    setStatus("Fetching geo & BGP data…");

    const [geo, bgpIP, ptr] = await Promise.all([
      getGeo(ip),
      getBGPForIP(ip),
      getPTR(ip),
    ]);

    const asnObj = tryVal(() => bgpIP.data.asns[0], null);
    const asn = asnObj?.asn;
    const org = asnObj?.name || "";
    const country = geo?.country_name || asnObj?.country_code || "";

    renderKPIs({ ip, asn, org, country });
    renderIPCard(ip, geo, bgpIP);
    renderPTR(ptr);
    renderClientCard(ip);

    if (!asn) {
      setStatus("No ASN found for this IP");
      return;
    }

    setStatus(`Loading ASN details for AS${asn}…`);
    const [rdapIP, rdapASN, bgpASN, pdb, ripe] = await Promise.all([
      getRDAP_IP(ip),
      getRDAP_ASN(asn),
      getBGP_ASN(asn),
      getPeeringDB(asn),
      getRIPAbuse(asn),
    ]);

    renderRDAP_IP(rdapIP);
    renderRDAP_ASN(rdapASN);
    renderBGP(asn, bgpASN);
    renderPDB(pdb);
    renderRIPE(ripe);
    renderCustomerSupport(org, asn);

    setStatus(`Done. AS${asn} (${org || "Unknown"})`);
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message}`);
  }
})();
