
// SNMP version toggle
document.getElementById('snmp_version').addEventListener('change', () => {
  const v = document.getElementById('snmp_version').value;
  document.getElementById('snmp-common').style.display = (v === 'v1' || v === 'v2c') ? 'block' : 'none';
  document.getElementById('snmp-v3').style.display = (v === 'v3') ? 'block' : 'none';
});

// Parse CSV/text lines
function parseLines(id, cols) {
  return document.getElementById(id).value.split(/\r?\n/).filter(l => l.trim()).map(l => {
    const parts = l.split(',').map(p => p.trim());
    let o = {};
    cols.forEach((c, i) => o[c] = parts[i] || '');
    return o;
  });
}

// Generate config
document.getElementById('generate-btn').addEventListener('click', () => {
  const data = {
    snmp_enable: document.getElementById('snmp-enable').checked,
    snmp_version_v1: document.getElementById('snmp_version').value === 'v1',
    snmp_version_v2c: document.getElementById('snmp_version').value === 'v2c',
    snmp_version_v3: document.getElementById('snmp_version').value === 'v3',
    hostname: document.getElementById('hostname').value,
    mgmt_iface: document.getElementById('mgmt_iface').value,
    mgmt_ip: document.getElementById('mgmt_ip').value,
    snmp_community: document.getElementById('snmp_community').value,
    snmp_v3_user: document.getElementById('snmp_v3_user').value,
    snmp_v3_auth: document.getElementById('snmp_v3_auth').value,
    snmp_v3_priv: document.getElementById('snmp_v3_priv').value,
    ntp_servers: document.getElementById('ntp_servers').value.split(/\r?\n/).filter(x => x),
    logging_host: document.getElementById('logging_host').value,
    username: document.getElementById('username').value,
    user_password: document.getElementById('user_password').value,
    vlans: parseLines('vlan_list', ['id', 'name']),
    interfaces: parseLines('iface_list', ['name', 'desc', 'ip']),
    ospf_process: document.getElementById('ospf_process').value,
    ospf_area: document.getElementById('ospf_area').value,
    ospf_network: document.getElementById('ospf_network').value,
    bgp_local_as: document.getElementById('bgp_local_as').value,
    bgp_neighbor_ip: document.getElementById('bgp_neighbor_ip').value,
    bgp_neighbor_as: document.getElementById('bgp_neighbor_as').value
  };

  const vendor = document.getElementById('vendor-select').value;
  const tpl = document.getElementById(`template-${vendor}`).innerHTML;
  const out = Mustache.render(tpl, data);

  document.getElementById('preview').textContent = out;
  const blob = new Blob([out], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const dl = document.getElementById('download-link');
  dl.href = url;
  dl.download = `${vendor}-${data.hostname || 'config'}.cfg`;
  dl.style.display = 'inline-block';
});

// Copy to clipboard
document.getElementById('copy-btn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('preview').textContent);
  alert('Copied!');
});
