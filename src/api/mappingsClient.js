// src/api/mappingsClient.js

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");

async function readError(res) {
  const text = await res.text().catch(() => "");
  return text || `HTTP ${res.status}`;
}

export async function getMappings() {
  const res = await fetch(`${API_BASE}/api/mappings`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function saveMapping(mapping) {
  const res = await fetch(`${API_BASE}/api/mappings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteMapping(anchor_rxcui) {
  const res = await fetch(`${API_BASE}/api/mappings/${encodeURIComponent(anchor_rxcui)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}