import { useState } from "react";
import { rxnormSearch } from "../api/rxnormClient";

export default function RxNormSearchPicker({
  label = "RxNorm Search",
  placeholder = "Search (e.g., Wegovy)…",
  preferTTY = "SBD",
  onlyTTY = null, // string "SBD" OR array ["SBD","SCD"]
  onPick,
  selectedRxCui = null, // single selected rxcui
  radioName = "rxnorm-picker", // must be unique per picker instance
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [results, setResults] = useState([]);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    setResults([]);

    try {
      const data = await rxnormSearch(q);

      // Filter by TTY (string or array)
      let filtered = data;
      if (Array.isArray(onlyTTY) && onlyTTY.length > 0) {
        filtered = data.filter((x) => onlyTTY.includes(x.tty));
      } else if (typeof onlyTTY === "string" && onlyTTY) {
        filtered = data.filter((x) => x.tty === onlyTTY);
      }

      // Prefer a TTY at the top
      const pref = filtered.filter((x) => x.tty === preferTTY);
      const other = filtered.filter((x) => x.tty !== preferTTY);

      setResults([...pref, ...other]);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }

  const filterLabel = Array.isArray(onlyTTY) ? onlyTTY.join(", ") : onlyTTY;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{label}</div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
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
              run();
            }
          }}
        />
        <button
          type="button"
          onClick={run}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #0070f3",
            background: "#0070f3",
            color: "white",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Search
        </button>
      </div>

      {loading && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>Searching…</div>}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: "red" }}>Error: {err.message}</div>}

      {!loading && results.length > 0 && (
        <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {results.map((r) => {
              const checked = selectedRxCui === r.rxcui;

              return (
                <label
                  key={`${r.rxcui}-${r.tty}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    borderTop: "1px solid #f2f2f2",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="radio"
                    name={radioName}
                    checked={checked}
                    onChange={() => onPick?.(r)}
                    style={{ marginTop: 2 }}
                  />

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      RxCUI {r.rxcui} · TTY {r.tty}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
        Tip: {preferTTY} results are shown first when available.
        {filterLabel ? ` Filtered to ${filterLabel}.` : ""}
      </div>
    </div>
  );
}