import express from "express";
import { readJson } from "../services/store.js";
import { resolveSeverity } from "../services/severity.js";

const router = express.Router();

router.get("/", (req, res) => {
  const anchor = req.query.anchor_rxcui;
  if (!anchor) {
    return res.status(400).json({ error: "Missing anchor_rxcui" });
  }

  // Org policy default severity
  const policy = readJson("org_policy.json", {});
  const orgDefault =
    policy?.alert_types?.formulary_substitution?.severity || "recommendation";

  // Find mapping
  const mappings = readJson("mappings.json", []);
  const mapping = mappings.find((m) => m.anchor_rxcui === anchor);

  if (!mapping) {
    return res.status(404).json({ error: "No mapping found for anchor_rxcui" });
  }

  // Apply Pattern A (downgrade-only)
  const effectiveSeverity = resolveSeverity({
    orgDefault,
    mappingOverride: mapping.severity_override,
  });

  // Was an override requested, and did it actually apply (vs clipped)?
  const hadOverride = !!mapping.severity_override;
  const overrideApplied =
    hadOverride &&
    String(mapping.severity_override).toLowerCase() === effectiveSeverity;

  const severitySource = !hadOverride
    ? "org_default"
    : overrideApplied
    ? "mapping_override_applied"
    : "mapping_override_clipped_to_org_default";

  return res.json({
    anchor: {
      rxcui: mapping.anchor_rxcui,
      name: mapping.anchor_name,
      tty: mapping.anchor_tty,
    },
    substitutes: mapping.substitutes || [],

    severity: effectiveSeverity,
    severity_source: severitySource,
    override_applied: overrideApplied,

    org_default_severity: orgDefault,

    // handy for debugging/governance UI later
    mapping_severity_override: mapping.severity_override || null,
    mapping_status: mapping.status || "draft",
    updated_at: mapping.updated_at || null,
  });
});

export default router;