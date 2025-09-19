document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("generate-btn").addEventListener("click", () => {
    const getVal = id => document.getElementById(id)?.value || "";
    const hostname = getVal("hostname") || "router";
    const iface = getVal("mgmt_iface");
    const ip = getVal("mgmt_ip");
    const vendor = getVal("vendor-select");
    const snmpEnabled = document.getElementById("snmp-enable").checked;
    const snmpVersion = getVal("snmp_version");
    const snmpCommunity = getVal("snmp_community");
    const snmpV3User = getVal("snmp_v3_user");
    const snmpV3Auth = getVal("snmp_v3_auth");
    const snmpV3Priv = getVal("snmp_v3_priv");
    const ntpServers = getVal("ntp_servers").split("\n").filter(Boolean);
    const syslog = getVal("logging_host");
    const username = getVal("username");
    const password = getVal("user_password");
    const ospfProcess = getVal("ospf_process");
    const ospfArea = getVal("ospf_area");
    const ospfNetwork = getVal("ospf_network");
    const bgpAS = getVal("bgp_local_as");
    const bgpNeighbor = getVal("bgp_neighbor_ip");
    const bgpNeighborAS = getVal("bgp_neighbor_as");

    const vlans = parseLines("vlan_list", ["id", "name"]);
    const ifaces = parseLines("iface_list", ["name", "desc", "ip"]);

    let config = "";
    const add = line => (config += line + "\n");

    switch (vendor) {
      case "cisco-ios":
        add(`hostname ${hostname}`);
        add(`interface ${iface}`);
        add(` ip address ${ip}`);
        add(` no shutdown`);
        if (snmpEnabled) {
          if (snmpVersion === "v1" || snmpVersion === "v2c") {
            add(`snmp-server community ${snmpCommunity} RO`);
          } else {
            add(`snmp-server user ${snmpV3User} auth md5 ${snmpV3Auth} priv aes 128 ${snmpV3Priv}`);
          }
        }
        ntpServers.forEach(s => add(`ntp server ${s}`));
        if (syslog) add(`logging host ${syslog}`);
        add(`username ${username} password ${password}`);
        vlans.forEach(v => {
          add(`vlan ${v.id}`);
          add(` name ${v.name}`);
        });
        ifaces.forEach(i => {
          add(`interface ${i.name}`);
          add(` description ${i.desc}`);
          add(` ip address ${i.ip}`);
        });
        add(`router ospf ${ospfProcess}`);
        add(` network ${ospfNetwork} area ${ospfArea}`);
        add(`router bgp ${bgpAS}`);
        add(` neighbor ${bgpNeighbor} remote-as ${bgpNeighborAS}`);
        break;

      case "juniper-junos":
        add(`system {`);
        add(` host-name ${hostname};`);
        if (snmpEnabled) {
          add(` snmp {`);
          if (snmpVersion === "v1" || snmpVersion === "v2c") {
            add(`  community ${snmpCommunity} { clients [ 0.0.0.0/0 ]; }`);
          } else {
            add(`  v3 { user ${snmpV3User} authentication-password ${snmpV3Auth} privacy-password ${snmpV3Priv}; }`);
          }
          add(` }`);
        }
        add(`}`);
        add(`interfaces {`);
        add(` ${iface} { unit 0 { family inet { address ${ip}; } } }`);
        ifaces.forEach(i => {
          add(` ${i.name} { description "${i.desc}"; unit 0 { family inet { address ${i.ip}; } } }`);
        });
        add(`}`);
        add(`vlans {`);
        vlans.forEach(v => add(` ${v.name} { vlan-id ${v.id}; }`));
        add(`}`);
        ntpServers.forEach(s => add(`set system ntp server ${s}`));
        if (syslog) add(`set system syslog host ${syslog}`);
        add(`set system login user ${username} authentication plain-text-password "${password}"`);
        add(`set protocols ospf area ${ospfArea} interface ${iface}.0`);
        add(`set protocols bgp group external type external`);
        add(`set protocols bgp group external local-as ${bgpAS}`);
        add(`set protocols bgp group external neighbor ${bgpNeighbor} peer-as ${bgpNeighborAS}`);
        break;

      case "arista-eos":
        add(`hostname ${hostname}`);
        add(`interface ${iface}`);
        add(` ip address ${ip}`);
        add(` no shutdown`);
        ifaces.forEach(i => {
          add(`interface ${i.name}`);
          add(` description ${i.desc}`);
          add(` ip address ${i.ip}`);
        });
        vlans.forEach(v => add(`vlan ${v.id}\n name ${v.name}`));
        ntpServers.forEach(s => add(`ntp server ${s}`));
        if (syslog) add(`logging host ${syslog}`);
        add(`username ${username} secret ${password}`);
        if (snmpEnabled) {
          if (snmpVersion === "v1" || snmpVersion === "v2c") {
            add(`snmp-server community ${snmpCommunity} ro`);
          } else {
            add(`snmp-server user ${snmpV3User} auth md5 ${snmpV3Auth} priv aes ${snmpV3Priv}`);
          }
        }
        add(`router ospf`);
        add(` network ${ospfNetwork} area ${ospfArea}`);
        add(`router bgp ${bgpAS}`);
        add(` neighbor ${bgpNeighbor} remote-as ${bgpNeighborAS}`);
        break;

      case "paloalto-pan-os":
        add(`set deviceconfig system hostname ${hostname}`);
        add(`set network interface ethernet ${iface} layer3 ip ${ip}`);
        ifaces.forEach(i => add(`set network interface ethernet ${i.name} layer3 ip ${i.ip}`));
        vlans.forEach(v => add(`set network vlan ${v.name} vlan-id ${v.id}`));
        ntpServers.forEach(s => add(`set deviceconfig system ntp-servers primary ${s}`));
        if (syslog) add(`set deviceconfig system syslog-host ${syslog}`);
        add(`set mgt-config users ${username} password`);
        if (snmpEnabled) {
          if (snmpVersion === "v1" || snmpVersion === "v2c") {
            add(`set snmp community ${snmpCommunity}`);
          } else {
            add(`set snmp v3 user ${snmpV3User} auth-password ${snmpV3Auth} priv-password ${snmpV3Priv}`);
          }
        }
        add(`# PAN-OS routing requires virtual router logic not included here`);
        break;

      default:
        add(`# Unknown vendor`);
        break;
    }

    document.getElementById("preview").textContent = config;
    const blob = new Blob([config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.getElementById("download-link");
    link.href = url;
    link.download = `${vendor}-${hostname}.cfg`;
    link.style.display = "inline-block";
  });

  document.getElementById("copy-btn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.getElementById("preview").textContent);
    alert("Copied!");
  });

  document.getElementById("snmp_version").addEventListener("change", () => {
    const version = document.getElementById("snmp_version").value;
    document.getElementById("snmp-common").style.display =
      version === "v1" || version === "v2c" ? "block" : "none";
    document.getElementById("snmp-v3").style.display = version === "v3" ? "block" : "none";
  });

  function parseLines(id, keys) {
    return document
      .getElementById(id)
      .value.split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        const obj = {};
        keys.forEach((key, i) => (obj[key] = parts[i] || ""));
        return obj;
      });
  }
});
