import { useEffect, useMemo, useState } from "react";
import { getMappings } from "../api/mappingsClient";
import RxNormSearchPicker from "../components/RxNormSearchPicker";

/* ---------------- Utilities ---------------- */

function norm(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.-]/g, "");
}

function frequencyToDosesPerDay(freq) {
  switch (freq) {
    case "daily": return 1;
    case "BID": return 2;
    case "TID": return 3;
    case "QID": return 4;
    case "weekly": return 1 / 7;
    default: return null;
  }
}

function parseRxNormDisplayName(name) {
  const s = String(name || "");
  const m = s.match(/\b(\d+(?:\.\d+)?)\s*(MCG|MG|G|ML|UNITS?)\b/i);

  const dose = m ? m[1] : "";
  const unit = m ? m[2].toLowerCase() : "";

  const lower = s.toLowerCase();
  let form = "";
  if (lower.includes("tablet")) form = "Tablet";
  else if (lower.includes("capsule")) form = "Capsule";
  else if (lower.includes("topical gel")) form = "Topical gel";
  else if (lower.includes("cream")) form = "Cream";

  let route = "";
  if (lower.includes("oral")) route = "PO";
  else if (lower.includes("topical")) route = "TOP";

  return { dose, unit, form, route };
}

function severityBanner(sev) {
  const s = String(sev || "").trim();

  if (!s) {
    return {
      text: "",
      bg: "#f7f7f7",
    };
  }

  let bg = "#f7f7f7"; // default

  const lower = s.toLowerCase();

  if (lower.includes("hard")) bg = "#fff1f2";
  else if (lower.includes("recommend")) bg = "#f0f7ff";
  else if (lower.includes("warn")) bg = "#fff7ed";

  return {
    text: s,
    bg,
  };
}

/* ---------------- Demo RTBC ---------------- */
function simulateOptumRtbc({ rxcui, name }) {
  const key = String(rxcui || "");
  const last = Number(key.slice(-1)) || 0;

  const lower = String(name || "").toLowerCase();

  // detect biosimilar-ish suffixes or known biosimilar brands
  const isBiosimilarish =
    /-atto|-bwwd|-afzb|-szzs|-aafi|-adaz/i.test(name || "") ||
    /amjevita|hadlima|hyrimoz|cyltezo|abrilada|idacio/i.test(lower);

  // base coverage (deterministic but simple)
  let covered = last % 2 === 0;

  // bias: biosimilars more likely to be covered
  if (isBiosimilarish) covered = true;

  // formulary status
  let formularyStatus = covered ? "covered" : "not-covered";
  if (covered && isBiosimilarish) formularyStatus = "covered-preferred";

  // simple cost share
  const copayUSD = covered ? (isBiosimilarish ? 10 : 25) : null;

  return {
    coverage: { covered, formularyStatus },
    patientCostShares: { copayUSD },
  };
}


/* ---------------- Main Component ---------------- */

export default function PrescribingPage() {
  const [selectedDrug, setSelectedDrug] = useState(null);

  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [form, setForm] = useState("");
  const [route, setRoute] = useState("PO");
  const [frequency, setFrequency] = useState("daily");
  const [daysSupply, setDaysSupply] = useState("30");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [mappings, setMappings] = useState([]);
  const [rtbcByKey, setRtbcByKey] = useState({});
const [rtbcSelectedDrug, setRtbcSelectedDrug] = useState(null);

  /* Auto-calculate quantity */
  useEffect(() => {
    const d = frequencyToDosesPerDay(frequency);
    const days = Number(daysSupply);
    if (!d || !days) return;
    if (!quantity) setQuantity(String(Math.round(d * days)));
  }, [frequency, daysSupply]);

  useEffect(() => {
    getMappings().then(setMappings);
  }, []);

const row = useMemo(() => {
  if (!selectedDrug) return null;

  return mappings.find(
    (m) =>
      (m?.status || "").toLowerCase() === "authorized" &&
      norm(m.anchor_name) === norm(selectedDrug.name)
  );
}, [selectedDrug, mappings]);


  useEffect(() => {
    if (!row) return;
    const next = {};
    next[row.anchor_rxcui] = simulateOptumRtbc(row);
    if (row.substitutes?.[0]) {
      next[row.substitutes[0].rxcui] = simulateOptumRtbc(row.substitutes[0]);
    }
    setRtbcByKey(next);
  }, [row]);

  const banner = severityBanner(row?.severity_override);
  const substitute = row?.substitutes?.[0] || null;
  const substituteRtbc = substitute ? rtbcByKey[substitute.rxcui] : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 , alignItems: "start"}}>

        {/* LEFT – PRESCRIPTION */}
        <div style={{ background: "#f0f7ff", borderRadius: 16, padding: 14 }}>
          <b>Prescription</b>

          <RxNormSearchPicker
            label="Medication"
            placeholder="Search medication…"
            selectedRxCui={selectedDrug?.rxcui || null}
            radioName="rx"
            onPick={(r) => {
              setSelectedDrug(r);
              const p = parseRxNormDisplayName(r?.name);
              if (!dose) setDose(p.dose);
              if (!form) setForm(p.form);
              if (!route) setRoute(p.route);
              if (p.unit) setDoseUnit(p.unit);
              setRtbcSelectedDrug(simulateOptumRtbc({ rxcui: r?.rxcui, name: r?.name }));
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <FieldInput label="Dose" value={dose} onChange={setDose} />
            <FieldSelect label="Unit" value={doseUnit} onChange={setDoseUnit} options={["mg","mcg","g","mL"]} />
            <FieldInput label="Form" value={form} onChange={setForm} />
            <FieldSelect label="Route" value={route} onChange={setRoute} options={["PO","TOP"]} />
            <FieldSelect label="Frequency" value={frequency} onChange={setFrequency} options={["daily","BID","TID"]} />
            <FieldInput label="Days supply" value={daysSupply} onChange={setDaysSupply} />
            <FieldInput label="Quantity" value={quantity} onChange={setQuantity} />
          </div>
{rtbcSelectedDrug && (
  <div
    style={{
      marginTop: 10,
      background: "white",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 10,
    }}
  >
    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: "#111827" }}>
      RTBC (selected medication)
    </div>

    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: rtbcSelectedDrug?.coverage?.covered ? "#ecfdf5" : "#fff1f2",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 13,
        fontWeight: 900,
      }}
    >
      <span>{rtbcSelectedDrug?.coverage?.covered ? "Covered" : "Not covered"}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: "#555" }}>
        {rtbcSelectedDrug?.coverage?.formularyStatus || "—"}
      </span>
    </div>
  </div>
)}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sig / Notes"
            style={{ width: "100%", marginTop: 12 }}
          />
        </div>

        {/* RIGHT – CDS (COMPACT, NO GAPS) */}
        {row && (
          <div style={{ display: "grid", gap: 8 }}>

         {/* Decision + Alternative */}
<div
  style={{
    background: banner.bg,
    borderRadius: 16,
    padding: 12,
    border: "1px solid #e5e7eb",
  }}
>
  <div style={{ fontWeight: 900, fontSize: 13, color: "#111827" }}>
    Prescribing alternative – level of importance:
  </div>
  <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: "#111827" }}>
    {row?.severity_override || "—"}
  </div>

              

          {row.substitutes?.[0] && (() => {
  const s = row.substitutes[0];
  const rtbc = rtbcByKey?.[s.rxcui];

  return (
    <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 12, padding: 10, background: "white" }}>
      <div style={{ fontWeight: 900 }}>{s.name}</div>

      <div style={{ fontSize: 12, color: "#666", fontFamily: "ui-monospace, Menlo, monospace", marginTop: 2 }}>
        RxCUI: {s.rxcui}
      </div>

      {/* RTBC summary strip */}
      <div
        style={{
          marginTop: 10,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: rtbc?.coverage?.covered ? "#ecfdf5" : "#fff1f2",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        <span>{rtbc?.coverage?.covered ? "Covered" : "Not covered"}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#555" }}>
          {rtbc?.coverage?.formularyStatus || "—"}
        </span>
      </div>
{!rtbc?.coverage?.covered && (
  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
    This alternative is lower cost overall but is not covered by the patient’s plan.
  </div>
)}

      {/* Cost */}
      <div style={{ marginTop: 8, fontSize: 12, color: "#111827" }}>
        <span style={{ fontWeight: 900 }}>Patient cost:</span>{" "}
        {rtbc?.patientCostShares?.coinsurancePct
          ? `${rtbc.patientCostShares.coinsurancePct}% coinsurance`
          : rtbc?.patientCostShares?.copayUSD != null
          ? `$${rtbc.patientCostShares.copayUSD} copay`
          : "—"}
        {rtbc?.patientCostShares?.estimatedTotalOutOfPocketUSD != null && (
          <span style={{ color: "#666" }}>
            {" • "}Est. OOP: ${rtbc.patientCostShares.estimatedTotalOutOfPocketUSD}
          </span>
        )}
      </div>
    </div>
  );
})()}

      </div>

            {/* Evidence – small gap */}
            <div style={{ background: "white", borderRadius: 16, padding: 12 }}>
              <b>Evidence</b>
              {row.evidence_nuggets?.map((n) => (
                <div key={n.id} style={{ marginTop: 6 }}>
                  <b>{n.title}</b>
                  <div>{n.detail}</div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Small Inputs ---------------- */

function FieldInput({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800 }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}