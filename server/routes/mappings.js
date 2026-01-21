import express from "express";
import { readJson, writeJson } from "../services/store.js";
import { requireAdminKey } from "../services/auth.js";


const router = express.Router();
const FILE = "mappings.json";

router.get("/", (_req, res) => {
  res.json(readJson(FILE, []));
});

router.post("/", (req, res) => {
  const existing = readJson(FILE, []);
    const incoming = {
    ...req.body,
    updated_at: new Date().toISOString(),
    status: req.body.status || "draft",
  };

  const updated = [
    ...existing.filter((e) => e.anchor_rxcui !== incoming.anchor_rxcui),
    incoming,
  ];
  writeJson(FILE, updated);
  res.json({ status: "saved" });
});

router.post("/:rxcui/authorize", requireAdminKey, (req, res) => {
  const existing = readJson(FILE, []);
  const idx = existing.findIndex((e) => e.anchor_rxcui === req.params.rxcui);
  if (idx === -1) return res.status(404).json({ error: "Mapping not found" });

  const actor = req.headers["x-actor"] || req.body?.actor || "unknown";
  const now = new Date().toISOString();

  const updatedEntry = {
    ...existing[idx],
    status: "authorized",
    authorized_by: String(actor),
    authorized_at: now,
    updated_at: now,
  };

  const updated = [...existing];
  updated[idx] = updatedEntry;
  writeJson(FILE, updated);

  // optional: audit log (if you already have a helper, call it here)
  // audit({ event: "mapping_authorize", actor, before: existing[idx], after: updatedEntry });

  res.json({ status: "authorized", entry: updatedEntry });
});

router.delete("/:rxcui", (req, res) => {
  const existing = readJson(FILE, []);
  const filtered = existing.filter(
    (e) => e.anchor_rxcui !== req.params.rxcui
  );
  writeJson(FILE, filtered);
  res.json({ status: "deleted" });
});

export default router;