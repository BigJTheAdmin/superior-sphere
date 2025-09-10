// src/lib/safeFetch.js
export async function safeFetchJSON(url, { timeout = 15000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    const text = await res.text();
    let json = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON from ${url}: ${e.message}`);
      }
    }
    if (!res.ok) {
      const snippet = JSON.stringify(json).slice(0, 200);
      throw new Error(`HTTP ${res.status} from ${url} ${snippet}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}
