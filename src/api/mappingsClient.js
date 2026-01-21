export async function getMappings() {
  const res = await fetch("/api/mappings");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveMapping(mapping) {
  const res = await fetch("/api/mappings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteMapping(anchor_rxcui) {
  const res = await fetch(`/api/mappings/${encodeURIComponent(anchor_rxcui)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}