export async function getOutput(anchor_rxcui) {
  const res = await fetch(`/api/output?anchor_rxcui=${encodeURIComponent(anchor_rxcui)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}