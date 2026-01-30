// src/api/orgPolicyClient.js

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// remove trailing slashes so we never get //api/...
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");

// helper to read errors nicely
async function readError(res) {
  const text = await res.text().catch(() => "");
  return text || `HTTP ${res.status}`;
}

export async function getOrgPolicy() {
  const res = await fetch(`${API_BASE}/api/org-policy`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function saveOrgPolicy(policy, { adminKey, actor, reason } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (adminKey) headers["x-admin-key"] = adminKey;
  if (actor) headers["x-actor"] = actor;

  const res = await fetch(`${API_BASE}/api/org-policy`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      policy,
      meta: { actor: actor || "unknown", reason: reason || "" },
    }),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}