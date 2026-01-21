const API = "http://localhost:3001"; // keep for now so we avoid proxy confusion

export async function authorizeMapping(anchor_rxcui, { adminKey, actor, reason } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 6000);

  const headers = { "Content-Type": "application/json" };
  if (adminKey) headers["x-admin-key"] = adminKey;
  if (actor) headers["x-actor"] = actor;

  try {
    const res = await fetch(`${API}/api/mappings/${encodeURIComponent(anchor_rxcui)}/authorize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ actor: actor || "unknown", reason: reason || "" }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(t);
  }
}