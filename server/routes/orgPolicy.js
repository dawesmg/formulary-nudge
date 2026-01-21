// server/routes/orgPolicy.js
import express from "express";
import { readJson, writeJson } from "../services/store.js";
import { requireAdminKey } from "../services/auth.js";
import { appendAudit } from "../services/audit.js";

const router = express.Router();
const FILE = "org_policy.json";

function defaultPolicy() {
  return {
    org_id: "ORG_001",
    alert_types: {
      formulary_substitution: {
        enabled: true,
        // You can keep this as "severity" for now; later we can rename to default_severity if desired.
        severity: "recommendation",
        timing: ["prescribing"],
        display_contexts: ["order-entry"],
        governance_required: true,
        // Pattern A support (optional now, but useful):
        // allow_mapping_override: true
      },
    },
  };
}

router.get("/", (_req, res) => {
  const policy = readJson(FILE, null);

  const isEmptyObject =
    policy &&
    typeof policy === "object" &&
    !Array.isArray(policy) &&
    Object.keys(policy).length === 0;

  if (!policy || isEmptyObject) {
    return res.json(defaultPolicy());
  }

  return res.json(policy);
});

/**
 * POST /api/org-policy
 * Requires x-admin-key header matching process.env.ADMIN_API_KEY
 *
 * Accepts:
 *   - policy object directly (backward compatible), OR
 *   - { policy: {...}, meta: { actor, reason } }
 */
router.post("/", requireAdminKey, (req, res) => {
  const before = readJson(FILE, {});
  const incoming = req.body;

  const policy =
    incoming && typeof incoming === "object" && incoming.policy
      ? incoming.policy
      : incoming;

  const meta =
    incoming && typeof incoming === "object" && incoming.meta
      ? incoming.meta
      : {};

  writeJson(FILE, policy);

  appendAudit({
    ts: new Date().toISOString(),
    event: "org_policy_update",
    actor: meta.actor || req.header("x-actor") || "unknown",
    reason: meta.reason || "",
    ip: req.ip,
    userAgent: req.header("user-agent") || "",
    before,
    after: policy,
  });

  res.json({ status: "saved" });
});

export default router;