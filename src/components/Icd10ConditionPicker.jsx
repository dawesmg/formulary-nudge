import { useEffect, useMemo, useState } from "react";

function norm(s) {
  return String(s || "").trim();
}

async function searchIcd10ByName(term, maxList = 50, signal) {
  const q = norm(term);
  if (q.length < 3) return [];

  const url =
    "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search" +
    `?terms=${encodeURIComponent(q)}` +
    `&sf=name` +
    `&df=code,name` +
    `&maxList=${maxList}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`ICD-10 lookup failed (${res.status})`);

  const data = await res.json();
  const displayRows = Array.isArray(data?.[3]) ? data[3] : [];

  return displayRows.map((r) => ({
    code: Array.isArray(r) ? r[0] : "",
    name: Array.isArray(r) ? r[1] : "",
  }));
}

/**
 * Enter-to-search ICD-10-CM picker.
 * Props:
 *  - label (string)
 *  - selectedCodes (string[]) e.g. ["M06.9"]
 *  - onChangeCodes (fn) -> (nextCodes: string[]) => void
 */
export default function Icd10ConditionPicker({
  label = "Condition (ICD-10-CM)",
  selectedCodes = [],
  onChangeCodes,
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
const hasSelection = (selectedCodes || []).length > 0;


 function add(code) {
  if (!code) return;
  onChangeCodes?.([code]);   // single-select: replace list
  setRows([]);               // hide results
  setInput("");              // optional: clear input box
  setQuery("");              // optional: clear committed query
}

  function remove(code) {
    onChangeCodes?.(selectedCodes.filter((c) => c !== code));
  }

  // run search only when query changes (Enter pressed)
  useEffect(() => {
    if (!query) {
      setRows([]);
      setShowAll(false);
      setErr(null);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const results = await searchIcd10ByName(query, 50, ctrl.signal);
        setRows(results);
        setShowAll(false);
      } catch (e) {
        if (e?.name !== "AbortError") setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [query]);

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          fontWeight: 900,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {!hasSelection && (
  <>
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          setQuery(input.trim());
        }
      }}
      placeholder='Type condition (min 3 chars) then press Enter (e.g., "rheumatoid")'
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #d1d5db",
        fontSize: 13,
        background: "white",
      }}
    />

    {loading && <div style={{ marginTop: 8, fontSize: 12 }}>Searching…</div>}
    {err && <div style={{ marginTop: 8, fontSize: 12, color: "#b00020" }}>{err}</div>}

    {!loading && rows.length > 0 && (
      <div style={{ marginTop: 8 }}>
        {/* your existing rows + Add buttons LIVE HERE */}
      </div>
    )}
  </>
)}

      {/* selected chips */}
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {selectedCodes.map((c) => (
          <span
            key={c}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fafafa",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {c}
            <button
              type="button"
              onClick={() => remove(c)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 900,
                color: "#666",
              }}
              aria-label={`Remove ${c}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {loading && <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Searching…</div>}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: "#b00020" }}>{err}</div>}

      {!loading && rows.length > 0 && (
        <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          {rows.slice(0, showAll ? 50 : 10).map((r) => {
            const selected = selectedSet.has(r.code);

            return (
              <div
                key={r.code}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderTop: "1px solid #eee",
                  background: selected ? "#f0f7ff" : "white",
                }}
              >
                {/* LEFT: Add */}
                <button
                  type="button"
                  onClick={() => add(r.code)}
                  disabled={selected}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: selected ? "#e5efff" : "white",
                    cursor: selected ? "default" : "pointer",
                    fontSize: 12,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                  }}
                >
                  {selected ? "✓" : "Select"}
                </button>

                {/* RIGHT: Name + code */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, lineHeight: 1.25 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#666", fontFamily: "ui-monospace, Menlo, monospace", marginTop: 2 }}>
                    {r.code}
                  </div>
                </div>
              </div>
            );
          })}

          {rows.length > 10 && (
            <div style={{ padding: 8, borderTop: "1px solid #eee", background: "#fafafa" }}>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {showAll ? "Show fewer" : `Show more (${rows.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}