/* ======================================================================
   ISP Intelligence – resilient client script
   - Proxy-first fetching, retries, status dots
   - Leaflet map (fills column); falls back to OSM iframe if Leaflet fails
   - Consistent "Key: Value" formatting with N/A fallback
   ====================================================================== */

(() => {
  /* ------------------ Config ------------------ */
  const PROXY = "/api/netfetch";
  const EP = {
    ipinfo: "https://ipapi.co/json/",
    ptr: (ip) => `https://dns.google/resolve?name=${encodeURIComponent(ptrName(ip))}&type=PTR`,
    rdap_ip: (ip) => `https://rdap.arin.net/registry/ip/${encodeURIComponent(ip)}`,
    rdap_asn: (asn) => `https://rdap.arin.net/registry/autnum/${encodeURIComponent(asn.replace(/^AS/i, ""))}`,
    bgp_asn: (asn) => `https://api.bgpview.io/asn/${asn.replace(/^AS/i, "")}`,
    bgp_prefixes: (asn) => `https://api.bgpview.io/asn/${asn.replace(/^AS/i, "")}/prefixes`,
    pdb_net: (asn) => `https://www.peeringdb.com/api/net?asn=${asn.replace(/^AS/i, "")}`,
    pdb_ixp: (net_id) => `https://www.peeringdb.com/api/netixlan?net_id=${net_id}`,
    pdb_fac: (net_id) => `https://www.peeringdb.com/api/netfac?net_id=${net_id}`,
    ripe_whois: (asn) => `https://stat.ripe.net/data/whois/data.json?resource=AS${asn.replace(/^AS/i, "")}`,
  };

  /* ------------------ DOM helpers ------------------ */
  const byId = (id) => document.getElementById(id);
  function setStatus(msg, state = "warn") {
    const el = byId("status");
    el.innerHTML = `<span class="dot ${state}"></span> ${msg}`;
  }
  const badge = (id, state) => {
    const card = document.querySelector(`${id} > summary`);
    if (!card) return;
    let b = card.querySelector(".badge");
    if (!b) {
      b = document.createElement("span");
      b.className = "badge";
      card.appendChild(b);
    }
    b.className = `badge ${state}`;
  };
  const addKV = (ul, k, v) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${k}:</b> <span>${valueOrNA(v)}</span>`;
    ul.appendChild(li);
  };
  function addKVList(container, obj) {
    const ul = document.createElement("ul");
    ul.className = "kv";
    Object.entries(obj).forEach(([k, v]) => {
      const li = document.createElement("li");
      li.innerHTML = `<b>${k}:</b> <span>${valueOrNA(v)}</span>`;
      ul.appendChild(li);
    });
    container.innerHTML = "";
    container.appendChild(ul);
  }
  function valueOrNA(v) {
    if (v === undefined || v === null) return "N/A";
    if (typeof v === "string" && v.trim() === "") return "N/A";
    return v;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function ptrName(ip) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.split(".").reverse().join(".") + ".in-addr.arpa";
    const parts = ip.toLowerCase().split("::");
    let hextets = [];
    if (parts.length === 1) hextets = ip.split(":");
    else {
      const left = parts[0] ? parts[0].split(":") : [];
      const right = parts[1] ? parts[1].split(":") : [];
      hextets = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
    }
    const hex = hextets.map((h) => h.padStart(4, "0")).join("");
    return hex.split("").reverse().join(".") + ".ip6.arpa";
  }

  /* ------------------ Request queue ------------------ */
  const queue = [];
  let active = 0;
  const MAX = 3;
  function run(task){ queue.push(task); pump(); }
  function pump(){
    while(active < MAX && queue.length){
      const t = queue.shift();
      active++;
      Promise.resolve().then(t).finally(()=>{ active--; pump(); });
    }
  }

  /* ------------------ Fetch utils ------------------ */
  async function netget(url, { directFallback = true, type = "json" } = {}) {
    try {
      const res = await fetch(`${PROXY}?url=${encodeURIComponent(url)}`, { headers: { "x-netfetch": "1" } });
      if (!res.ok) throw new ProxyError(res.status);
      return type === "json" ? res.json() : res.text();
    } catch (e) {
      if (e instanceof ProxyError && !directFallback) throw e;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`direct ${res.status}`);
      return type === "json" ? res.json() : res.text();
    }
  }
  class ProxyError extends Error { constructor(status){ super(`proxy ${status}`); this.status = status; } }
  async function retry(fn, tries = 3){
    let delay = 400;
    for(let i=0;i<tries;i++){
      try { return await fn(); }
      catch(e){ if(i===tries-1) throw e; delay = Math.min(3000, Math.random()*delay*3 + 200); await sleep(delay); }
    }
  }

  /* ------------------ Boot ------------------ */
  (async function init(){
    try {
      setStatus("Loading client IP…", "warn");
      const ipinfo = await retry(() => fetch(EP.ipinfo).then(r=>r.json()));
      const ip = ipinfo.ip || ipinfo.ip_address || "";
      const asn = (ipinfo.asn && `${ipinfo.asn}`.toUpperCase()) || extractASN(ipinfo.asn_org || ipinfo.org) || "";
      const org = ipinfo.org || ipinfo.asn_org || "";
      const country = ipinfo.country_name || ipinfo.country || "";
      const lat = Number(ipinfo.latitude);
      const lon = Number(ipinfo.longitude);

      byId("kpi-ip").textContent = ip || "N/A";
      byId("kpi-asn").textContent = asn || "N/A";
      byId("kpi-org").textContent = org || "N/A";
      byId("kpi-country").textContent = country || "N/A";

      const ipList = byId("ip-list");
      addKV(ipList, "IP Address", `<span class="mono">${ip || "N/A"}</span>`);
      addKV(ipList, "ASN", `<span class="mono">${asn || "N/A"}</span>`);
      addKV(ipList, "Organization", org || "N/A");
      addKV(ipList, "City", ipinfo.city || "N/A");
      addKV(ipList, "Region", ipinfo.region || "N/A");
      addKV(ipList, "Country", country || "N/A");

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        addKV(ipList, "Latitude", lat.toString());
        addKV(ipList, "Longitude", lon.toString());
        renderMap(lat, lon); // Leaflet map (fills column) w/ fallback
      }

      badge("#ip-card", "ok");
      setStatus("Resolving PTR & registry data…", "warn");

      run(() => loadPTR(ip));
      run(() => loadRDAP_IP(ip));
      run(() => loadRDAP_ASN(asn));
      run(() => loadBGP(asn));
      run(() => loadPeeringDB(asn));
      run(() => loadRIPE(asn));
      run(() => loadClientCard());

      setStatus("Loaded.", "ok");
    } catch (e) {
      console.error(e);
      setStatus("Fatal: could not load client IP.", "err");
      badge("#ip-card", "err");
    }
  })();

  function extractASN(s){
    if(!s) return "";
    const m = /AS(\d+)/i.exec(s);
    return m ? `AS${m[1]}` : "";
  }

  /* ------------------ Sections (unchanged logic) ------------------ */
  async function loadPTR(ip){
    const ul = byId("ptr-list");
    try{
      const data = await retry(()=> netget(EP.ptr(ip), { directFallback:true }));
      const answers = (data.Answer || []).filter(a => a.type === 12);
      if (answers.length) {
        answers.forEach(a => addKV(ul, "PTR", a.data.replace(/\.$/, "")));
        badge("#ptr-card", "ok");
      } else {
        addKV(ul, "PTR", "No record");
        badge("#ptr-card", "warn");
      }
    } catch(e){
      addKV(ul, "PTR", "Lookup failed");
      badge("#ptr-card", "err");
    }
  }

  async function loadRDAP_IP(ip){
    const owner = byId("rdap-owner");
    const events = byId("rdap-events");
    const contacts = byId("rdap-contacts");
    try{
      const rdap = await retry(()=> netget(EP.rdap_ip(ip), { directFallback:false }));
      const cidrs = (rdap.cidr0_cidrs || [])
        .map(c => `${c.v4prefix || c.v6prefix}/${c.length}`)
        .join(", ") || "N/A";
      addKVList(owner, { Handle: rdap.handle || "N/A", Name: rdap.name || "N/A", Type: rdap.type || "N/A", Country: rdap.country || "N/A", CIDR: cidrs });

      events.innerHTML = "";
      const evUL = document.createElement("ul"); evUL.className = "kv";
      (rdap.events || []).forEach(ev => {
        const li = document.createElement("li");
        li.innerHTML = `<b>${ev.eventAction || "event"}:</b> <span>${ev.eventDate || ""}</span>`;
        evUL.appendChild(li);
      });
      events.appendChild(evUL);

      contacts.innerHTML = "";
      (rdap.entities || []).forEach(ent => {
        const name = ent.vcardArray?.[1]?.find?.(x=>x[0]==="fn")?.[3] || ent.handle || "N/A";
        const roles = (ent.roles || []).join(", ") || "N/A";
        const email = ent.vcardArray?.[1]?.find?.(x=>x[0]==="email")?.[3] || "";
        const tel = ent.vcardArray?.[1]?.find?.(x=>x[0]==="tel")?.[3] || "";
        const ul = document.createElement("ul"); ul.className="kv";
        addKV(ul, "Name", name); addKV(ul, "Role(s)", roles);
        if (email) addKV(ul, "Email", `<a href="mailto:${email}">${email}</a>`);
        if (tel) addKV(ul, "Phone", tel);
        contacts.appendChild(ul);
      });

      badge("#rdap-card", "ok");
    } catch(e){
      owner.innerHTML = `<p class="muted">RDAP(IP) limited (proxy/upstream)</p>`;
      badge("#rdap-card", "warn");
    }
  }

  async function loadRDAP_ASN(asn){
    const ul = byId("rdap-asn");
    try{
      const data = await retry(()=> netget(EP.rdap_asn(asn), { directFallback:false }));
      ul.innerHTML = "";
      addKV(ul, "Handle", data.handle || `AS${(asn||"").replace(/^AS/i,"")}`);
      addKV(ul, "Name", data.name || "N/A");
      addKV(ul, "Country", data.country || "N/A");
      const created = (data.events||[]).find(e=>/registration/i.test(e.eventAction))?.eventDate || "";
      const updated = (data.events||[]).find(e=>/last changed/i.test(e.eventAction))?.eventDate || "";
      addKV(ul, "Registered", created || "N/A");
      addKV(ul, "Last Changed", updated || "N/A");
      badge("#rdap-asn-card", "ok");
    } catch(e){
      addKV(ul, "Status", "RDAP ASN limited");
      badge("#rdap-asn-card", "warn");
    }
  }

  async function loadBGP(asn){
    const ul = byId("bgp-asn-list");
    const pref = byId("bgp-prefixes");
    const peers = { peers: byId("bgp-peers"), ups: byId("bgp-upstreams"), downs: byId("bgp-downstreams") };
    try{
      let overview;
      try { overview = await retry(()=> netget(EP.bgp_asn(asn), { directFallback:false })); }
      catch(e){ await sleep(800); overview = await netget(EP.bgp_asn(asn), { directFallback:false }); }

      let prefixes=null;
      try { prefixes = await retry(()=> netget(EP.bgp_prefixes(asn), { directFallback:false })); }
      catch(e){ /* rate limited */ }

      ul.innerHTML="";
      addKV(ul,"ASN", `AS${overview?.data?.asn ?? (asn||"").replace(/^AS/i,"")}`);
      addKV(ul,"Name", overview?.data?.name || "N/A");
      addKV(ul,"Country", overview?.data?.country_code || "N/A");
      addKV(ul,"Description", overview?.data?.description_short || "N/A");

      pref.innerHTML = "";
      const mkTable = (arr, title) => {
        if (!arr?.length) return "";
        const rows = arr.slice(0,50).map(p=>`<tr><td>${p.prefix}</td><td>${p.name||""}</td><td>${p.country_code||""}</td></tr>`).join("");
        return `<h3>${title}</h3><table class="kv"><thead><tr><th>Prefix</th><th>Name</th><th>CC</th></tr></thead><tbody>${rows}</tbody></table>`;
      };
      if (prefixes?.data) {
        pref.innerHTML = mkTable(prefixes.data.ipv4_prefixes, "IPv4") + mkTable(prefixes.data.ipv6_prefixes, "IPv6");
        badge("#bgp-prefix-card","ok");
      } else {
        pref.innerHTML = `<ul class="kv"><li><b>Status:</b> <span>Limited (rate limit)</span></li></ul>`;
        badge("#bgp-prefix-card","warn");
      }

      const rel = overview?.data?.relationships || {};
      fillList(peers.peers, rel.peers);
      fillList(peers.ups, rel.upstreams);
      fillList(peers.downs, rel.downstreams);

      badge("#bgp-asn-card","ok");
      badge("#bgp-peers-card", (rel.peers?.length||rel.upstreams?.length||rel.downstreams?.length) ? "ok" : "warn");
    } catch(e){
      addKV(byId("bgp-asn-list"), "Status", "BGP data limited");
      badge("#bgp-asn-card","warn");
      badge("#bgp-prefix-card","warn");
      badge("#bgp-peers-card","warn");
    }
  }

  async function loadPeeringDB(asn){
    const net = byId("pdb-net");
    const ixp = byId("pdb-ixp");
    const fac = byId("pdb-fac");
    const contacts = byId("pdb-list");
    try{
      const netResp = await retry(()=> netget(EP.pdb_net(asn), { directFallback:false }));
      const item = netResp.data?.[0];
      if (!item) throw new Error("No PeeringDB record");
      addKVList(net, {
        Name: item.name,
        AKA: item.aka || "—",
        Website: item.website ? `<a href="${item.website}" target="_blank" rel="noreferrer">${item.website}</a>` : "—",
        "IRR as-set": item.irr_as_set || "—",
        Policy: item.policy_general || "—",
      });
      const [ixpResp, facResp] = await Promise.all([
        retry(()=> netget(EP.pdb_ixp(item.id), { directFallback:false })),
        retry(()=> netget(EP.pdb_fac(item.id), { directFallback:false })),
      ]);
      ixp.innerHTML=""; (ixpResp.data||[]).forEach(p => addKV(ixp, `${p.name} (${p.ix_id})`, `${p.ipaddr4||""} ${p.ipaddr6||""}`.trim()));
      fac.innerHTML=""; (facResp.data||[]).forEach(f => addKV(fac, f.name, f.city||""));
      contacts.innerHTML=""; addKV(contacts, "Note", "Direct emails are hidden in PeeringDB; see RDAP/RIPE for contacts.");
      badge("#pdb-net-card","ok"); badge("#pdb-ixp-card","ok"); badge("#pdb-fac-card","ok"); badge("#pdb-card","warn");
    } catch(e){
      net.innerHTML = `<ul class="kv"><li><b>Status:</b> <span>PeeringDB unavailable</span></li></ul>`;
      badge("#pdb-net-card","warn"); badge("#pdb-ixp-card","warn"); badge("#pdb-fac-card","warn"); badge("#pdb-card","warn");
    }
  }

  async function loadRIPE(asn){
    const ul = byId("ripe-list");
    try{
      const data = await retry(()=> netget(EP.ripe_whois(asn), { directFallback:false }));
      const recs = data?.data?.records?.flat()?.filter(r=>r.key && r.value) || [];
      if (!recs.length) throw new Error("No records");
      ul.innerHTML = "";
      recs.slice(0,40).forEach(r=> addKV(ul, r.key, r.value));
      badge("#ripe-card","ok");
    } catch(e){
      addKV(ul, "Status", "RIPEstat limited");
      badge("#ripe-card","warn");
    }
  }

  async function loadClientCard(){
    const ul = byId("client-card-content");
    ul.innerHTML = "";
    addKV(ul, "User Agent", navigator.userAgent);
    addKV(ul, "Language", navigator.language);
    addKV(ul, "Platform", navigator.platform);
    addKV(ul, "Time", new Date().toString());
    badge("#client-card","ok");
  }

  /* ------------------ Lists ------------------ */
  function fillList(ul, arr){
    ul.innerHTML = "";
    if (!arr?.length){ addKV(ul, "Status", "No data"); return; }
    arr.slice(0,50).forEach(a => addKV(ul, `AS${a.asn}`, a.name || "N/A"));
  }

  /* ------------------ Leaflet Map (with fallback) ------------------ */
  let leafletReadyPromise = null;
  function ensureLeaflet(){
    if (window.L) return Promise.resolve();
    if (leafletReadyPromise) return leafletReadyPromise;
    leafletReadyPromise = new Promise((resolve, reject) => {
      // NOTE: no SRI attributes (to avoid integrity mismatch)
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);

      const js = document.createElement("script");
      js.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
      js.onload = () => resolve();
      js.onerror = () => reject(new Error("Leaflet load failed"));
      document.head.appendChild(js);
    });
    return leafletReadyPromise;
  }

  async function renderMap(lat, lon){
    const host = byId("loc-map");
    host.style.display = "block";
    host.innerHTML = ""; // reset

    try {
      await ensureLeaflet();

      // Create the map container element Leaflet expects
      const mapDiv = document.createElement("div");
      mapDiv.style.width = "100%";
      mapDiv.style.height = "100%";
      mapDiv.style.minHeight = "260px";
      host.appendChild(mapDiv);

      const map = L.map(mapDiv, { zoomControl: true, attributionControl: true });
      map.setView([lat, lon], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      L.marker([lat, lon]).addTo(map);

      // Ensure full stretch on layout/resizes
      setTimeout(() => map.invalidateSize(), 50);
      const card = document.getElementById("ip-card");
      if (card) card.addEventListener("toggle", () => setTimeout(() => map.invalidateSize(), 80));
      window.addEventListener("resize", () => setTimeout(() => map.invalidateSize(), 80));
    } catch (e) {
      console.warn("Leaflet unavailable, using static OSM embed", e);
      // Fallback: OSM iframe (fixed height but better than empty)
      const bbox = [lon-0.05, lat-0.03, lon+0.05, lat+0.03];
      const url = "https://www.openstreetmap.org/export/embed.html?bbox="+bbox.map(n=>n.toFixed(4)).join("%2C")+"&layer=mapnik&marker="+[lat.toFixed(4),lon.toFixed(4)].join("%2C");
      host.innerHTML = `<iframe title="Location Map" src="${url}" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;min-height:260px;border:0;display:block;"></iframe>`;
    }
  }
})();
