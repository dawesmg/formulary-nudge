const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function rxnormSearch(q) {
  if (!q?.trim()) return [];

  const res = await fetch(
    `${API_BASE}/api/rxnorm/search?q=${encodeURIComponent(q.trim())}`
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}