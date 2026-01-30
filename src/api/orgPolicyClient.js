// src/api/orgPolicyClient.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function getOrgPolicy() {
  const res = await fetch(`${API_BASE}/api/org-policy`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveOrgPolicy(policy, { adminKey, actor, reason } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (adminKey) headers["x-admin-key"] = adminKey;
  if (actor) headers["x-actor"] = actor;

  const res = await fetch(`${API_BASE}/api/org-policy`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      policy,
      meta: {
        actor: actor || "unknown",
        reason: reason || "",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}