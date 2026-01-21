const ORDER = ["informational", "recommendation", "warning", "hard-stop"];

function rank(x) {
  const i = ORDER.indexOf(String(x || "").toLowerCase());
  return i === -1 ? ORDER.indexOf("recommendation") : i;
}

// Pattern A: mapping may downgrade only; never escalate above org default.
export function resolveSeverity({ orgDefault, mappingOverride }) {
  const org = rank(orgDefault);
  const map = mappingOverride ? rank(mappingOverride) : org;

  // Lower rank = less interruptive; allow downgrade (min)
  const effective = Math.min(org, map);
  return ORDER[effective];
}