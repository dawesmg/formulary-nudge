export async function rxnormSearch(q) {
  if (!q?.trim()) return [];
  const res = await fetch(`/api/rxnorm/search?q=${encodeURIComponent(q.trim())}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}