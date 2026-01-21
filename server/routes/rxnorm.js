import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing q" });

  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(q)}`;

  try {
    const r = await fetch(url);
    const data = await r.json();

    const results =
      data?.drugGroup?.conceptGroup
        ?.flatMap((g) => g.conceptProperties || [])
        .map((c) => ({
          rxcui: c.rxcui,
          name: c.name,
          tty: c.tty,
        })) || [];

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;