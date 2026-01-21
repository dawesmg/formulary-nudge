import { useEffect, useMemo, useState } from "react";
import { getMappings, saveMapping, deleteMapping } from "../api/mappingsClient";
import { getOrgPolicy } from "../api/orgPolicyClient";
import { getOutput } from "../api/outputClient";
import RxNormSearchPicker from "../components/RxNormSearchPicker";

// ---- Severity gradient helpers (ONE source of truth) ----
const SEVERITY_GRADIENTS = {
  informational: { from: "#f4f6f8", to: "#f4f6f8" },
  recommendation: { from: "#ffeb3b", to: "#ffeb3b" },
  warning: { from: "#ff9800", to: "#ff9800" },
  "hard-stop": { from: "#ff5500", to: "#ff5500" },
};

function severityGradient(severity) {
  const g = SEVERITY_GRADIENTS[severity] || SEVERITY_GRADIENTS.informational;
  return `linear-gradient(90deg, ${g.from} 0%, ${g.to} 100%)`;
}

export default function MappingEditorPage({ onNavigate }) {
  const [mappings, setMappings] = useState([]);

  // Post-save modal
  const [postSaveChoiceOpen, setPostSaveChoiceOpen] = useState(false);

  // Handoff from Review -> Editor
  const [pendingOpenRxcui, setPendingOpenRxcui] = useState(() => {
    const v = localStorage.getItem("openAnchorRxcui");
    if (v) localStorage.removeItem("openAnchorRxcui");
    return v || null;
  });

  // Single anchor + single substitute
  const [selectedAnchor, setSelectedAnchor] = useState(null);
  const [selectedSubstitute, setSelectedSubstitute] = useState(null);

  // UI status
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);

  // Org policy (default severity)
  const [orgDefaultSeverity, setOrgDefaultSeverity] = useState("recommendation");
  const [policyInfo, setPolicyInfo] = useState({ loading: true, error: null });

  // Optional mapping-level override (Pattern A: downgrade-only)
  const [severityOverride, setSeverityOverride] = useState("");

  // Runtime preview
  const [preview, setPreview] = useState(null);
  const [previewInfo, setPreviewInfo] = useState({ loading: false, error: null });

  // Evidence nuggets
  const [evidenceCount, setEvidenceCount] = useState(3); // 1–5
  const [evidenceNuggets, setEvidenceNuggets] = useState([
    { id: "N1", title: "Cheaper", detail: "" },
    { id: "N2", title: "Improves adherence", detail: "" },
    { id: "N3", title: "Improves outcomes", detail: "" },
  ]);
  const [activeNuggetIndex, setActiveNuggetIndex] = useState(0);
// Condition-dependent nudges (v1: free-text)
const [conditionMode, setConditionMode] = useState("any"); // "any" | "all"
const [conditionsEnabled, setConditionsEnabled] = useState(false);
const [includeConditions, setIncludeConditions] = useState([]); // array of strings
const [excludeConditions, setExcludeConditions] = useState([]); // array of strings
const [conditionDraft, setConditionDraft] = useState("");

  // Keep evidence array sized to evidenceCount
  useEffect(() => {
    setEvidenceNuggets((prev) => {
      const next = [...prev];
      while (next.length < evidenceCount) {
        const n = next.length + 1;
        next.push({ id: `N${n}`, title: "", detail: "" });
      }
      if (next.length > evidenceCount) next.length = evidenceCount;
      return next;
    });

    setActiveNuggetIndex((i) => Math.max(0, Math.min(i, evidenceCount - 1)));
  }, [evidenceCount]);

  // ---------- init ----------
  useEffect(() => {
    let alive = true;

    async function init() {
      // Load mappings
      try {
        await refresh();
      } catch (e) {
        console.warn("Could not load mappings:", e);
      }

      // Load org policy (severity context)
      try {
        setPolicyInfo({ loading: true, error: null });
        const p = await getOrgPolicy();
        if (!alive) return;

        const fs = p?.alert_types?.formulary_substitution || {};
        setOrgDefaultSeverity(fs.severity || "recommendation");
        setPolicyInfo({ loading: false, error: null });
      } catch (e) {
        if (!alive) return;
        console.warn("Could not load org policy:", e);
        setPolicyInfo({ loading: false, error: e });
      }
    }

    init();
    return () => {
      alive = false;
    };
  }, []);

  async function refresh() {
    setErr(null);
    const data = await getMappings();
    setMappings(data || []);
  }

  // Find saved mapping for selected anchor
  const selected = useMemo(() => {
    if (!selectedAnchor?.rxcui) return null;
    return mappings.find((m) => m.anchor_rxcui === selectedAnchor.rxcui) || null;
  }, [mappings, selectedAnchor]);

  // Review -> Editor handoff: wait until mapping exists
  useEffect(() => {
    if (!pendingOpenRxcui) return;

    const m = mappings.find((x) => x.anchor_rxcui === pendingOpenRxcui);
    if (!m) return; // mappings not loaded yet

    setSelectedAnchor({
      rxcui: m.anchor_rxcui,
      name: m.anchor_name || m.anchor_rxcui,
      tty: m.anchor_tty || "SBD",
    });

    const sub = Array.isArray(m.substitutes) ? m.substitutes[0] : null;
    setSelectedSubstitute(sub || null);

    setPendingOpenRxcui(null);
  }, [pendingOpenRxcui, mappings]);

  // Load saved mapping into editor when anchor changes
  useEffect(() => {
    if (!selected) {
      setSelectedSubstitute(null);
      setSeverityOverride("");

      // reset evidence when no saved mapping exists for this anchor
      setEvidenceCount(3);
      setEvidenceNuggets([
        { id: "N1", title: "Cheaper", detail: "" },
        { id: "N2", title: "Improves adherence", detail: "" },
        { id: "N3", title: "Improves outcomes", detail: "" },
      ]);
      setActiveNuggetIndex(0);
      // ✅ reset conditions
      setConditionsEnabled(false);
      setConditionMode("any");
      setIncludeConditions([]);
      setExcludeConditions([]);
      setConditionDraft("");
      return;
    }

    setSeverityOverride(selected.severity_override || "");

    const subs = Array.isArray(selected.substitutes) ? selected.substitutes : [];
    setSelectedSubstitute(subs.length > 0 ? subs[0] : null);
    // ✅ load conditions if present
    const cond = selected.conditions || null;
    if (cond && (Array.isArray(cond.include) || Array.isArray(cond.exclude))) {
      setConditionsEnabled(true);
      setConditionMode(cond.mode === "all" ? "all" : "any");
      setIncludeConditions(Array.isArray(cond.include) ? cond.include : []);
      setExcludeConditions(Array.isArray(cond.exclude) ? cond.exclude : []);
    } else {
      setConditionsEnabled(false);
      setConditionMode("any");
      setIncludeConditions([]);
      setExcludeConditions([]);
    }
    setConditionDraft("");

    // Load evidence if present
    if (Array.isArray(selected.evidence_nuggets) && selected.evidence_nuggets.length > 0) {
      const limited = selected.evidence_nuggets.slice(0, 5).map((x, idx) => ({
        id: x.id || `N${idx + 1}`,
        title: x.title || "",
        detail: x.detail || "",
      }));
      setEvidenceCount(limited.length);
      setEvidenceNuggets(limited);
      setActiveNuggetIndex(0);
    } else {
      setEvidenceCount(3);
      setEvidenceNuggets([
        { id: "N1", title: "Cheaper", detail: "" },
        { id: "N2", title: "Improves adherence", detail: "" },
        { id: "N3", title: "Improves outcomes", detail: "" },
      ]);
      setActiveNuggetIndex(0);
    }
  }, [selected]);





  // Runtime preview
  useEffect(() => {
    (async () => {
      if (!selectedAnchor?.rxcui) {
        setPreview(null);
        setPreviewInfo({ loading: false, error: null });
        return;
      }
      try {
        setPreviewInfo({ loading: true, error: null });
        const out = await getOutput(selectedAnchor.rxcui);
        setPreview(out);
        setPreviewInfo({ loading: false, error: null });
      } catch (e) {
        const msg = String(e.message || "");
        if (msg.includes("HTTP 404")) {
          setPreview(null);
          setPreviewInfo({
            loading: false,
            error: new Error("No saved mapping yet. Click Save to generate runtime preview."),
          });
        } else {
          setPreview(null);
          setPreviewInfo({ loading: false, error: e });
        }
      }
    })();
  }, [selectedAnchor, mappings]);

  function clearCurrent() {
    setSelectedAnchor(null);
    setSelectedSubstitute(null);
    setSeverityOverride("");
    setPreview(null);
    setStatus(null);
    setErr(null);
    setConditionsEnabled(false);
    setConditionMode("any");
    setIncludeConditions([]);
    setExcludeConditions([]);
    setConditionDraft("");
    
    setEvidenceCount(3);
    setEvidenceNuggets([
      { id: "N1", title: "Cheaper", detail: "" },
      { id: "N2", title: "Improves adherence", detail: "" },
      { id: "N3", title: "Improves outcomes", detail: "" },
    ]);
    setActiveNuggetIndex(0);
  }

  async function onSave() {
    setStatus(null);
    setErr(null);

    if (!selectedAnchor?.rxcui) {
      setErr(new Error("Please select an anchor drug (SBD) first."));
      return;
    }

    const substitutes = selectedSubstitute
      ? [{ rxcui: selectedSubstitute.rxcui, name: selectedSubstitute.name, tty: selectedSubstitute.tty }]
      : [];

    const mapping = {
      anchor_rxcui: selectedAnchor.rxcui,
      anchor_name: selectedAnchor.name,
      anchor_tty: selectedAnchor.tty,

      substitutes,

      severity_override: severityOverride || undefined,
      evidence_nuggets: evidenceNuggets.slice(0, 5),
      conditions: conditionsEnabled
     ? {
      mode: conditionMode,
      include: includeConditions,
      exclude: excludeConditions,
    }
    : undefined,

      status: "draft",
      updated_at: new Date().toISOString(),
    };

    try {
      await saveMapping(mapping);
      await refresh();
      setStatus("Saved mapping.");
      setPostSaveChoiceOpen(true);
    } catch (e) {
      setErr(e);
    }
  }

  async function onDelete() {
    if (!selectedAnchor?.rxcui) return;
    await deleteMapping(selectedAnchor.rxcui);
    clearCurrent();
    await refresh();
  }

  const effectiveSeverity = severityOverride || orgDefaultSeverity;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Pickers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <RxNormSearchPicker
          label="Select anchor brand name drug you wish to create a nudge for (SBD)"
          placeholder="Search anchor (e.g., Humira, Zocor)…"
          preferTTY="SBD"
          onlyTTY="SBD"
          selectedRxCui={selectedAnchor?.rxcui || null}
          radioName="anchor"
          onPick={(r) => {
            setStatus(null);
            setErr(null);
            setSelectedAnchor(r);
          }}
        />

        <RxNormSearchPicker
          label="Select substitute (SBD or SCD)"
          placeholder="Search substitute (e.g., simvastatin)…"
          preferTTY="SCD"
          onlyTTY={["SBD", "SCD"]}
          selectedRxCui={selectedSubstitute?.rxcui || null}
          radioName="substitute"
          onPick={(r) => {
            setStatus(null);
            setErr(null);
            setSelectedSubstitute(r);
          }}
        />
      </div>

      {/* Current mapping header + actions */}
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            
            border: "1px solid rgba(0,0,0,0.15)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Current mapping</div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={clearCurrent}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.25)",
                  background: "rgba(255,255,255,0.85)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                New mapping
              </button>

              <button
                type="button"
                onClick={onSave}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.25)",
                  background: "rgba(0,112,243,0.95)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Save
              </button>

              <button
                type="button"
                onClick={onDelete}
                disabled={!selectedAnchor}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.25)",
                  background: "rgba(255,255,255,0.85)",
                  color: "#c00",
                  cursor: selectedAnchor ? "pointer" : "default",
                  fontSize: 13,
                  fontWeight: 800,
                  opacity: selectedAnchor ? 1 : 0.5,
                }}
              >
                Delete
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 900 }}>
            {selectedAnchor ? (
              <>
                Anchor: <span style={{ fontWeight: 900 }}>{selectedAnchor.name}</span>
              </>
            ) : (
              "No anchor selected"
            )}
            {selectedSubstitute && (
              <>
                {" "}→ Substitute: <span style={{ fontWeight: 900 }}>{selectedSubstitute.name}</span>
              </>
            )}
          </div>

         <div style={{ fontSize: 11, opacity: 0.9, marginTop: 6 }}>
  Severity:
  <span
    style={{
      marginLeft: 6,
      padding: "2px 8px",
      borderRadius: 999,
      background: severityGradient(effectiveSeverity),
      fontWeight: 800,
      textTransform: "uppercase",
      color: "#1f2937",
      border: "1px solid rgba(0,0,0,0.15)",
      display: "inline-block",
    }}
  >
    {effectiveSeverity}
  </span>
</div>
        </div>

        {err && <div style={{ color: "red", fontSize: 13 }}>Error: {err.message}</div>}
        {status && <div style={{ fontSize: 13, opacity: 0.85 }}>{status}</div>}
      </div>

      {/* Severity controls + preview */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Severity & runtime preview</div>

        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
          Org default severity: <strong>{policyInfo.loading ? "loading…" : orgDefaultSeverity}</strong>
          {policyInfo.error ? <span style={{ color: "red", marginLeft: 8 }}>(policy load failed)</span> : null}
        </div>
<label style={{ fontSize: 12 }}>
  Optional severity downgrade for this mapping&nbsp;
  <select
    value={severityOverride}
    onChange={(e) => setSeverityOverride(e.target.value)}
    style={{
      padding: 6,
      borderRadius: 8,
      border: "1px solid #ccc",
      marginLeft: 6,
      color: "#1f2937",
      fontWeight: 700,
    }}
  >
    <option value="">Use org default</option>
    <option value="informational">informational</option>
    <option value="recommendation">recommendation</option>
    <option value="warning">warning</option>
    <option value="hard-stop">hard-stop</option>
  </select>
</label>


        <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4, marginTop: 6 }}>
          Downgrade-only model: the effective severity will never exceed the organisation default.
        </div>

        {selectedAnchor?.rxcui && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid #eee", background: "#fcfcfc" }}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Runtime preview</div>

            {previewInfo.loading ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Loading preview…</div>
            ) : previewInfo.error ? (
              <div style={{ fontSize: 12, color: "red" }}>Preview unavailable: {previewInfo.error.message}</div>
            ) : preview ? (
              <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                Effective severity: <strong>{preview.severity}</strong>{" "}
                <span style={{ opacity: 0.75 }}>({preview.severity_source})</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.75 }}>No preview available.</div>
            )}
          </div>
        )}
      </div>

{/* Conditions (optional) */}
<div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" }}>
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
    <div style={{ fontSize: 13, fontWeight: 900 }}>Condition-dependent nudge</div>

    <label style={{ marginLeft: "auto", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="checkbox"
        checked={conditionsEnabled}
        onChange={(e) => setConditionsEnabled(e.target.checked)}
      />
      Enable
    </label>
  </div>

  <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 10, lineHeight: 1.4 }}>
    If enabled, the substitution will only be suggested when the patient’s problem list matches these conditions.
    (v1 is free-text; later we’ll upgrade to SNOMED/ICD-10 codes.)
  </div>

  {conditionsEnabled && (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 12 }}>
          Match mode&nbsp;
          <select
            value={conditionMode}
            onChange={(e) => setConditionMode(e.target.value)}
            style={{ padding: 6, borderRadius: 8, border: "1px solid #ccc", marginLeft: 6 }}
          >
            <option value="any">any (recommended)</option>
            <option value="all">all</option>
          </select>
        </label>

        <div style={{ fontSize: 11, opacity: 0.7 }}>
          “Any” = at least one include condition present. “All” = every include condition present.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          value={conditionDraft}
          onChange={(e) => setConditionDraft(e.target.value)}
          placeholder="Add include condition (e.g., Rheumatoid arthritis)"
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 13,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = conditionDraft.trim();
              if (!v) return;
              setIncludeConditions((prev) => (prev.includes(v) ? prev : [...prev, v]));
              setConditionDraft("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            const v = conditionDraft.trim();
            if (!v) return;
            setIncludeConditions((prev) => (prev.includes(v) ? prev : [...prev, v]));
            setConditionDraft("");
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #0070f3",
            background: "#0070f3",
            color: "white",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Add
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, background: "#fcfcfc" }}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Include</div>
          {includeConditions.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No include conditions.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {includeConditions.map((c) => (
                <div
                  key={c}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: "8px 10px",
                    background: "white",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{c}</div>
                  <button
                    type="button"
                    onClick={() => setIncludeConditions((prev) => prev.filter((x) => x !== c))}
                    style={{
                      marginLeft: "auto",
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, background: "#fcfcfc" }}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Exclude (optional)</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
            If any exclude condition is present, the nudge will not fire.
          </div>

          <button
            type="button"
            onClick={() => {
              const v = prompt("Add exclude condition (free text):");
              const t = (v || "").trim();
              if (!t) return;
              setExcludeConditions((prev) => (prev.includes(t) ? prev : [...prev, t]));
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #555",
              background: "white",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 10,
            }}
          >
            + Add exclude condition
          </button>

          {excludeConditions.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No exclude conditions.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {excludeConditions.map((c) => (
                <div
                  key={c}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: "8px 10px",
                    background: "white",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{c}</div>
                  <button
                    type="button"
                    onClick={() => setExcludeConditions((prev) => prev.filter((x) => x !== c))}
                    style={{
                      marginLeft: "auto",
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )}
</div>


      {/* Evidence nuggets */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Evidence nuggets</div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Number of nuggets</div>
            <select
              value={evidenceCount}
              onChange={(e) => setEvidenceCount(Number(e.target.value))}
              style={{ padding: 6, borderRadius: 8, border: "1px solid #ccc", fontSize: 12 }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 12 }}>
          {/* Left: titles */}
          <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fcfcfc" }}>
            <div style={{ padding: 10, borderBottom: "1px solid #eee", fontSize: 12, fontWeight: 900 }}>
              High-level nuggets (headlines)
            </div>

            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {evidenceNuggets.map((n, idx) => {
                const active = idx === activeNuggetIndex;
                return (
                  <div
                    key={n.id || idx}
                    onClick={() => setActiveNuggetIndex(idx)}
                    style={{
                      border: `1px solid ${active ? "#0070f3" : "#eaeaea"}`,
                      background: active ? "#f0f7ff" : "white",
                      borderRadius: 10,
                      padding: 10,
                      cursor: "pointer",
                    }}
                    title="Click to edit details on the right"
                  >
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Nugget {idx + 1}</div>
                    <input
                      value={n.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEvidenceNuggets((prev) => prev.map((x, j) => (j === idx ? { ...x, title: val } : x)));
                      }}
                      placeholder="e.g., Cheaper"
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: detail */}
          <div style={{ border: "1px solid #eee", borderRadius: 10, background: "white" }}>
            <div style={{ padding: 10, borderBottom: "1px solid #eee", fontSize: 12, fontWeight: 900 }}>
              Detailed evidence (for selected nugget)
            </div>

            <div style={{ padding: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                Editing nugget {activeNuggetIndex + 1}:{" "}
                <strong>{evidenceNuggets[activeNuggetIndex]?.title || "Untitled"}</strong>
              </div>

              <textarea
                value={evidenceNuggets[activeNuggetIndex]?.detail || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setEvidenceNuggets((prev) =>
                    prev.map((x, j) => (j === activeNuggetIndex ? { ...x, detail: val } : x))
                  );
                }}
                placeholder="Write the supporting evidence here (guidelines, citations, local formulary notes, etc.)"
                style={{
                  width: "100%",
                  minHeight: 220,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 13,
                  fontFamily: "inherit",
                  lineHeight: 1.4,
                }}
              />

              <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
                Tip: Keep the headline short. Put rationale, references, and implementation notes in the detailed box.
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            Saved status: <strong>{selected.status || "draft"}</strong>
          </div>
        )}
      </div>

      {/* Post-save choice modal */}
      {postSaveChoiceOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setPostSaveChoiceOpen(false)}
        >
          <div
            style={{
              width: "min(520px, 92vw)",
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Saved ✅</div>

            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 14 }}>
              What would you like to do next?
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPostSaveChoiceOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Continue editing
              </button>

              <button
                type="button"
                onClick={() => {
                  setPostSaveChoiceOpen(false);
                  onNavigate?.("review");
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #0070f3",
                  background: "#0070f3",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Proceed to Review & Authorization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}