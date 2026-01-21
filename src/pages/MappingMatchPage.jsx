import { useEffect, useMemo, useState } from "react";
import { getMappings } from "../api/mappingsClient";

function norm(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.-]/g, "");
}

function toRows(mappings) {
  if (Array.isArray(mappings)) return mappings;
  if (mappings && typeof mappings === "object") return Object.values(mappings);
  return [];
}

function collectCandidates(row) {
  const base = [row?.anchor_name, row?.anchor_rxcui, row?.anchor_tty]
    .filter(Boolean)
    .map(String);

  if (Array.isArray(row?.substitutes)) {
    for (const s of row.substitutes) {
      if (s?.name) base.push(String(s.name));
      if (s?.rxcui) base.push(String(s.rxcui));
      if (s?.tty) base.push(String(s.tty));
    }
  }

  const synFields = ["synonyms", "alias", "aliases", "brand_synonyms"];
  for (const f of synFields) {
    const v = row?.[f];
    if (Array.isArray(v)) base.push(...v.map(String));
    else if (typeof v === "string") base.push(v);
  }

  return Array.from(new Set(base));
}

function bestMatch(query, rows) {
  const qn = norm(query);
  if (!qn) return null;

  // exact
  for (const row of rows) {
    for (const cand of collectCandidates(row)) {
      if (norm(cand) === qn) return { row, how: `Exact match: "${cand}"` };
    }
  }

  // fuzzy
  let best = null;
  for (const row of rows) {
    for (const cand of collectCandidates(row)) {
      const cn = norm(cand);
      if (!cn) continue;

      let score = 0;
      if (cn.includes(qn)) score = 80;
      if (qn.includes(cn)) score = Math.max(score, 70);

      const qt = new Set(qn.split(" ").filter(Boolean));
      const ct = new Set(cn.split(" ").filter(Boolean));
      let overlap = 0;
      for (const t of qt) if (ct.has(t)) overlap++;
      score += overlap * 5;

      if (score > 0 && (!best || score > best.score)) {
        best = { row, score, how: `Fuzzy match vs "${cand}" (score ${score})` };
      }
    }
  }

  return best ? { row: best.row, how: best.how } : null;
}

function buildSuggestions(rows, query) {
  const set = new Set();

  for (const r of rows) {
    if (r?.anchor_name) set.add(String(r.anchor_name));
    if (Array.isArray(r?.substitutes)) {
      for (const s of r.substitutes) {
        if (s?.name) set.add(String(s.name));
      }
    }
  }

  const all = Array.from(set).sort((a, b) => a.localeCompare(b));
  const q = norm(query);

  if (!q) return all.slice(0, 12);
  return all.filter((x) => norm(x).includes(q)).slice(0, 12);
}

function severityBanner(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "hard_stop" || s === "hard stop") {
    return { text: "Hard stop: substitution required", bg: "#fff1f2" };
  }
  if (s === "recommendation" || s === "recommend") {
    return { text: "Recommendation: consider biosimilar substitution", bg: "#f0f7ff" };
  }
  if (s) {
    return { text: `Suggestion: ${sev}`, bg: "#f7f7f7" };
  }
  return { text: "Suggestion available", bg: "#f7f7f7" };
}

async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  return false;
}

// -------------------------
// Simulated Optum-style RTBC (DEMO)
// -------------------------
function hashStringToInt(s) {
  const str = String(s || "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickFrom(arr, n) {
  return arr[n % arr.length];
}

function dollars(n) {
  if (n === null || n === undefined) return null;
  return Math.round(n);
}

function simulateOptumRtbc({ rxcui, name }, context = {}) {
  const key = String(rxcui || name || "");
  const h = hashStringToInt(key);

  // Demo plan context (optional: can wire dropdown later)
  const planName = context.planName || "Optum Commercial (Demo)";
  const memberId = context.memberId || `M-${String(h).slice(0, 8)}`;
  const groupId = context.groupId || `G-${String(h).slice(-6)}`;

  // Deterministic coverage window: Jan 1 current year -> Dec 31 current year
  const now = new Date();
  const year = now.getFullYear();
  const coverageStart = `${year}-01-01`;
  const coverageEnd = `${year}-12-31`;

  // Formulary status + tier
  const formularyStatuses = ["covered-preferred", "covered-non-preferred", "covered", "not-covered"];
  let formularyStatus = pickFrom(formularyStatuses, h);

  // Biosimilar-ish bias (helps the demo story)
  const isBiosimilarish = /-atto|-bwwd|-afzb|-szzs|-aafi|-adaz/i.test(String(name || ""));
  if (isBiosimilarish && formularyStatus === "covered-non-preferred" && (h % 2 === 0)) {
    formularyStatus = "covered-preferred";
  }
  if (isBiosimilarish && formularyStatus === "not-covered" && (h % 5 === 0)) {
    formularyStatus = "covered";
  }

  const covered = formularyStatus !== "not-covered";

  // Cost share simulation
  const coinsurancePct = covered ? pickFrom([0, 0.1, 0.2, 0.25, 0.3], h) : null; // 0 = copay model
  const copay = covered ? dollars(10 + (h % 60)) : null;

  const deductibleRemaining = covered ? dollars((h % 2000) + 0) : null; // 0–1999
  const baseDrugCost = covered ? dollars(1200 + (h % 2800)) : null; // 1200–3999

  // Total OOP estimate: copay OR coinsurance*cost, plus deductible contribution (simplified)
  const coinsuranceCost = covered && coinsurancePct ? dollars(baseDrugCost * coinsurancePct) : null;
  const patientShare = covered ? (coinsurancePct ? coinsuranceCost : copay) : null;

  const deductibleApplied = covered ? Math.min(deductibleRemaining, patientShare ?? 0) : null;
  const totalOutOfPocket = covered
    ? dollars((patientShare ?? 0) + (deductibleApplied ?? 0))
    : null;

  // Authorization flags
  const paRequired = covered && (formularyStatus === "covered-non-preferred" ? (h % 100) < 65 : (h % 100) < 20);
  const paOnFile = paRequired && (h % 100) < 40; // sometimes already on file
  const stepTherapy = covered && (formularyStatus === "covered-non-preferred" ? (h % 100) < 45 : (h % 100) < 15);

  // Network status
  const networkStatus = pickFrom(["in-network", "out-of-network"], h + 3);

  // Limits / restrictions
  const quantityLimit = covered && (h % 100) < 30;
  const dosageRestriction = covered && (h % 100) < 18;

  // Lower-cost alternatives (use mapping substitutes as "alternatives" when we have them later)
  // Here we keep a placeholder list; your UI can also inject mapping substitutes.
  const lowerCostAlternatives = covered
    ? [
        { label: "Lower-cost alternative available", hint: isBiosimilarish ? "Preferred biosimilar on formulary" : "Preferred alternative on formulary" },
      ]
    : [];

  // Technical + transaction
  const transactionStatus = "200 OK";
  const requestId = `RTBC-${String(h).slice(0, 10)}`;

  return {
    // Top-level identifiers
    vendor: "Optum RTBC (Simulated)",
    requestId,
    transactionStatus,

    drug: {
      name: String(name || ""),
      rxcui: String(rxcui || ""),
    },

    // 1) Patient Cost Shares
    patientCostShares: {
      copayUSD: coinsurancePct ? null : copay,
      coinsurancePct: coinsurancePct ? Math.round(coinsurancePct * 100) : null,
      deductibleRemainingUSD: deductibleRemaining,
      baseDrugCostUSD: baseDrugCost,
      estimatedTotalOutOfPocketUSD: totalOutOfPocket,
      notes: covered ? "Estimate only (demo)" : "Not covered (demo)",
    },

    // 2) Coverage Status and Authorization
    coverage: {
      formularyStatus, // covered-preferred / covered-non-preferred / covered / not-covered
      covered,
      priorAuthorization: {
        required: paRequired,
        onFile: paOnFile,
      },
      stepTherapy: {
        required: stepTherapy,
        notes: stepTherapy ? "Other therapies must be tried first (demo)" : "No step therapy (demo)",
      },
    },

    // 3) Pharmacy/Service Information
    pharmacyService: {
      networkStatus,
      lowerCostAlternatives,
      restrictions: {
        quantityLimit,
        dosageRestriction,
        details: [
          quantityLimit ? "Quantity limit applies (demo)" : null,
          dosageRestriction ? "Dosage restriction applies (demo)" : null,
        ].filter(Boolean),
      },
    },

    // 4) Technical and Administrative Data
    admin: {
      coverageDates: { start: coverageStart, end: coverageEnd },
      coverageIdentification: {
        planName,
        memberId,
        groupId,
        patient: {
          firstName: context.firstName || "Demo",
          lastName: context.lastName || "Patient",
          dob: context.dob || "1970-01-01",
        },
      },
    },

    generatedAt: new Date().toISOString(),
  };
}

export default function MappingMatchPage() {
  const [drugEntry, setDrugEntry] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedOption, setSelectedOption] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);

  // RTBC results keyed by rxcui (string)
  const [rtbcByRxcui, setRtbcByRxcui] = useState({});

  const rows = useMemo(() => toRows(mappings), [mappings]);
  const match = useMemo(() => bestMatch(drugEntry, rows), [drugEntry, rows]);
  const row = match?.row || null;

  const suggestions = useMemo(() => buildSuggestions(rows, drugEntry), [rows, drugEntry]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMappings();
        setMappings(data);
      } catch (e) {
        setError(e?.message || "Failed to load mappings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    // reset selected option when the matched mapping changes
    setSelectedOption(null);
    setCopyStatus(null);
  }, [row?.anchor_rxcui]);

  // Simulate RTBC whenever the matched mapping changes
  useEffect(() => {
    if (!row) {
      setRtbcByRxcui({});
      return;
    }

    const drugs = [
      { rxcui: row.anchor_rxcui, name: row.anchor_name },
      ...(Array.isArray(row.substitutes)
        ? row.substitutes.map((s) => ({ rxcui: s.rxcui, name: s.name }))
        : []),
    ].filter((d) => d.rxcui || d.name);

    // clear first to show "checking..."
    setRtbcByRxcui({});

    const timer = setTimeout(() => {
      const next = {};
      for (const d of drugs) {
        const key = String(d.rxcui || d.name);
        next[key] = simulateOptumRtbc(d);
      }
      setRtbcByRxcui(next);
    }, 250);

    return () => clearTimeout(timer);
  }, [row?.anchor_rxcui, row?.substitutes?.length]);

  async function handleCopyPayload(option) {
    const payload = {
      anchor: {
        rxcui: row?.anchor_rxcui,
        name: row?.anchor_name,
        tty: row?.anchor_tty,
        rtbc: rtbcByRxcui[String(row?.anchor_rxcui || row?.anchor_name)] || null,
      },
      substitute: option
        ? {
            rxcui: option?.rxcui,
            name: option?.name,
            tty: option?.tty,
            rtbc: rtbcByRxcui[String(option?.rxcui || option?.name)] || null,
          }
        : null,
      severity: row?.severity_override,
      evidence_nuggets: row?.evidence_nuggets || [],
      conditions: row?.conditions || null,
      status: row?.status,
      updated_at: row?.updated_at,
    };

    const ok = await copyToClipboard(JSON.stringify(payload, null, 2));
    setCopyStatus(ok ? "Copied payload to clipboard." : "Could not copy (clipboard blocked).");
    setTimeout(() => setCopyStatus(null), 2500);
  }

  const banner = severityBanner(row?.severity_override);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: "0 0 6px 0" }}>Prescription Selection</h2>
      <p style={{ fontSize: 13, opacity: 0.75, margin: 0, lineHeight: 1.4 }}>
        Select a drug to prescribe for your patient.
      </p>

      {loading && <div>Loading mappings…</div>}
      {error && <div style={{ color: "#b00020" }}>{error}</div>}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: 360, flex: "1 1 360px" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Drug entry</div>

          {/* Autocomplete */}
          <div style={{ position: "relative" }}>
            <input
              value={drugEntry}
              onChange={(e) => {
                setDrugEntry(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              placeholder='e.g. "Humira" or "Amjevita"'
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
            />

            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  background: "white",
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                }}
              >
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setDrugEntry(s);
                      setShowSuggestions(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: 0,
                      background: "white",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
            Mappings loaded: <b>{rows.length}</b>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
        {/* LEFT */}
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Prescribing preview</div>

          {!drugEntry.trim() ? (
            <div style={{ color: "#666" }}>Enter or select a drug to preview a substitution rule.</div>
          ) : !match ? (
            <div style={{ color: "#b00020" }}>No match found.</div>
          ) : (
            <>
              {/* Banner */}
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  background: banner.bg,
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                {banner.text}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>Match method</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                  {match.how}
                </div>
              </div>

              <ConditionsPanel conditions={row?.conditions} />

              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <Field label="Anchor (SBD)" value={pickFirst(row, ["anchor_name"])} />
                <Field label="Anchor RxCUI" value={pickFirst(row, ["anchor_rxcui"])} />
                <Field label="Status" value={pickFirst(row, ["status"])} />
              </div>

              {/* RTBC (Anchor) */}
              <RtbcPanel
                title="RTBC (Anchor)"
                rtbc={rtbcByRxcui[String(row?.anchor_rxcui || row?.anchor_name)]}
              />

              {/* Options */}
              {Array.isArray(row?.substitutes) && row.substitutes.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: "#666", fontWeight: 800, marginBottom: 8 }}>
                    Substitution options
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {row.substitutes.map((s, idx) => {
                      const isSelected = selectedOption?.rxcui && selectedOption.rxcui === s?.rxcui;
                      const rtbc = rtbcByRxcui[String(s?.rxcui || s?.name)];

                      return (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 12,
                            padding: 12,
                            background: isSelected ? "#f0f7ff" : "white",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                            <div style={{ fontWeight: 900, fontSize: 14 }}>{s?.name || "—"}</div>
                            <div style={{ fontSize: 12, color: "#666" }}>{s?.tty || "—"}</div>
                          </div>

                          <div style={{ marginTop: 6, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "#333" }}>
                            RxCUI: {s?.rxcui || "—"}
                          </div>

                          {/* RTBC inline for option */}
                          <RtbcInline rtbc={rtbc} />

                         <div style={{ marginTop: 10 }}>
  <button
    type="button"
    onClick={() => setSelectedOption(s)}
    style={{
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "white",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 900,
    }}
  >
    {isSelected ? "Selected" : "Select"}
  </button>
</div>
                        </div>
                      );
                    })}
                  </div>

                  {copyStatus && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#333" }}>{copyStatus}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Details</div>

          {!match ? (
            <div style={{ color: "#666" }}>No payload to display.</div>
          ) : (
            <>
              <EvidenceNuggets nuggets={row?.evidence_nuggets} />

              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
                  Show raw JSON
                </summary>
                <pre
                  style={{
                    background: "#fafafa",
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    marginTop: 10,
                    maxHeight: 420,
                    overflow: "auto",
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(row, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value ?? <span style={{ color: "#999" }}>—</span>}</div>
    </div>
  );
}

function pickFirst(row, keys) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function EvidenceNuggets({ nuggets }) {
  const list = Array.isArray(nuggets) ? nuggets : [];
  if (list.length === 0) {
    return (
      <div style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
        No evidence nuggets attached.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Evidence</div>

      <div style={{ display: "grid", gap: 10 }}>
        {list.map((n) => (
          <div key={n.id || n.title} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 800 }}>{n.title || "Evidence"}</div>
              {n.id && (
                <div style={{ fontSize: 12, color: "#666", fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {n.id}
                </div>
              )}
            </div>

            <ExpandableText text={n.detail || ""} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConditionsPanel({ conditions }) {
  if (!conditions) return null;

  const mode = conditions.mode || "any";
  const include = Array.isArray(conditions.include) ? conditions.include : [];
  const exclude = Array.isArray(conditions.exclude) ? conditions.exclude : [];

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Conditions</div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 800 }}>Mode:</span> {mode}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800, marginBottom: 4 }}>Include</div>
            {include.length ? <Pills items={include} /> : <div style={{ color: "#999" }}>—</div>}
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800, marginBottom: 4 }}>Exclude</div>
            {exclude.length ? <Pills items={exclude} /> : <div style={{ color: "#999" }}>—</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandableText({ text, maxChars = 260 }) {
  const [open, setOpen] = useState(false);
  const clean = String(text || "").trim();
  if (!clean) return <div style={{ color: "#999", marginTop: 6 }}>—</div>;

  const short = clean.length > maxChars ? clean.slice(0, maxChars).trim() + "…" : clean;

  return (
    <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.35, color: "#333" }}>
      {open ? clean : short}
      {clean.length > maxChars && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {open ? "Show less" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}

function Pills({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((x, idx) => (
        <span
          key={idx}
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid #eee",
            background: "#fafafa",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {String(x)}
        </span>
      ))}
    </div>
  );
}

// ---------- RTBC UI ----------
function RtbcPanel({ title, rtbc }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, color: "#666", fontWeight: 800, marginBottom: 6 }}>{title}</div>

      {!rtbc ? (
        <div style={{ fontSize: 13, color: "#666" }}>Checking RTBC…</div>
      ) : (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, fontSize: 13 }}>
          {/* 2) Coverage + Auth summary */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div>
              <b>{rtbc.coverage.covered ? "Covered" : "Not covered"}</b>{" "}
              <span style={{ color: "#666" }}>• {rtbc.coverage.formularyStatus}</span>
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>{rtbc.transactionStatus}</div>
          </div>

          {/* 1) Cost shares */}
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div>
              <span style={{ fontWeight: 800 }}>Patient cost share:</span>{" "}
              {rtbc.patientCostShares.coinsurancePct
                ? `${rtbc.patientCostShares.coinsurancePct}% coinsurance`
                : rtbc.patientCostShares.copayUSD !== null
                ? `$${rtbc.patientCostShares.copayUSD} copay`
                : "—"}
            </div>
            <div style={{ color: "#666", fontSize: 12 }}>
              Deductible remaining: {rtbc.patientCostShares.deductibleRemainingUSD !== null ? `$${rtbc.patientCostShares.deductibleRemainingUSD}` : "—"} •
              Est. total OOP: {rtbc.patientCostShares.estimatedTotalOutOfPocketUSD !== null ? `$${rtbc.patientCostShares.estimatedTotalOutOfPocketUSD}` : "—"}
            </div>
          </div>

          {/* 2) PA + Step */}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tag ok={!rtbc.coverage.priorAuthorization.required} text={rtbc.coverage.priorAuthorization.required ? (rtbc.coverage.priorAuthorization.onFile ? "PA on file" : "PA required") : "No PA"} />
            <Tag ok={!rtbc.coverage.stepTherapy.required} text={rtbc.coverage.stepTherapy.required ? "Step therapy" : "No step therapy"} />
            <Tag ok={rtbc.pharmacyService.networkStatus === "in-network"} text={rtbc.pharmacyService.networkStatus === "in-network" ? "In-network" : "Out-of-network"} />
          </div>

          {/* 3) Restrictions */}
          {rtbc.pharmacyService.restrictions.details?.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              Restrictions: {rtbc.pharmacyService.restrictions.details.join(" • ")}
            </div>
          )}

          {/* 4) Admin */}
          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            Plan: {rtbc.admin.coverageIdentification.planName} • Coverage: {rtbc.admin.coverageDates.start} to {rtbc.admin.coverageDates.end}
          </div>

          {/* Raw payload for demo */}
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
              View RTBC payload
            </summary>
            <pre
              style={{
                marginTop: 8,
                background: "#fafafa",
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 10,
                maxHeight: 240,
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(rtbc, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function RtbcInline({ rtbc }) {
  if (!rtbc) return <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>RTBC: checking…</div>;

  const coveredText = rtbc.coverage.covered ? "Covered" : "Not covered";
  const paText = rtbc.coverage.priorAuthorization.required
    ? rtbc.coverage.priorAuthorization.onFile
      ? "PA on file"
      : "PA required"
    : "No PA";

  const costText = rtbc.patientCostShares.coinsurancePct
    ? `${rtbc.patientCostShares.coinsurancePct}%`
    : rtbc.patientCostShares.copayUSD !== null
    ? `$${rtbc.patientCostShares.copayUSD}`
    : "—";

  return (
    <div style={{ marginTop: 6, fontSize: 12, color: "#333", display: "flex", gap: 10, flexWrap: "wrap" }}>
      <span><b>RTBC:</b> {coveredText}</span>
      <span style={{ color: "#666" }}>{rtbc.coverage.formularyStatus}</span>
      <span style={{ color: "#666" }}>Cost: {costText}</span>
      <span style={{ color: "#666" }}>{paText}</span>
      {rtbc.coverage.stepTherapy.required && <span style={{ color: "#666" }}>Step</span>}
      {rtbc.pharmacyService.restrictions.quantityLimit && <span style={{ color: "#666" }}>Qty</span>}
    </div>
  );
}
function Tag({ ok, text }) {
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid #eee",
        background: ok ? "#fafafa" : "#fff1f2",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {text}
    </span>
  );
}