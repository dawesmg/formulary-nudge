// src/api/reviewClient.js

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");

async function readError(res) {
  const text = await res.text().catch(() => "");
  return text || `HTTP ${res.status}`;
}

export async function authorizeMapping(anchor_rxcui, { adminKey, actor, reason } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 6000);

  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (adminKey) headers["x-admin-key"] = adminKey;
  if (actor) headers["x-actor"] = actor;

  try {
    const res = await fetch(
      `${API_BASE}/api/mappings/${encodeURIComponent(anchor_rxcui)}/authorize`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ actor: actor || "unknown", reason: reason || "" }),
        signal: controller.signal,
      }
    );

    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}