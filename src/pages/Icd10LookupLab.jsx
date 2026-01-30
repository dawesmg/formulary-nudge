import { useEffect, useMemo, useState } from "react";

function norm(s) {
  return String(s || "").trim();
}

async function searchIcd10cm(terms, maxList = 12, signal) {
  const q = norm(terms);
  if (!q) return [];

  const url =
    "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search" +
    `?terms=${encodeURIComponent(q)}` +
  `&maxList=${maxList}` +
`&sf=name` +
`&df=code,name`;


  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // Format per NLM: [total, codes[], extras{}, displayRows[]]
  const data = await res.json();
  const displayRows = Array.isArray(data?.[3]) ? data[3] : [];

  // displayRows rows look like: [code, name]
  return displayRows.map((row) => ({
    code: Array.isArray(row) ? row[0] : "",
    name: Array.isArray(row) ? row[1] : "",
  }));
}

export default function Icd10LookupLab() {
  const [q, setQ] = useState("rheumatoid arthritis");
  const [rows, setRows] = useState([]);
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);
        const url =
          "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search" +
          `?terms=${encodeURIComponent(norm(q))}&maxList=12&sf=name&df=code,name`;

        const res = await fetch(url, { signal: ctrl.signal });
        const json = await res.json();
        setRaw(json);

        // parse displayRows
        const displayRows = Array.isArray(json?.[3]) ? json[3] : [];
        setRows(
          displayRows.map((r) => ({
            code: Array.isArray(r) ? r[0] : "",
            name: Array.isArray(r) ? r[1] : "",
          }))
        );
      } catch (e) {
        if (e?.name !== "AbortError") setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const hasRows = useMemo(() => rows.some((r) => r.code || r.name), [rows]);

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
      <h2 style={{ margin: 0 }}>ICD-10-CM Lookup Lab</h2>
      <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
        Testing NLM Clinical Tables ICD-10-CM endpoint (direct browser fetch).
      </p>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, color: "#666", fontWeight: 800, marginBottom: 6 }}>
          Search terms
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='e.g. "rheumatoid arthritis"'
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontSize: 14,
          }}
        />
        {loading && <div style={{ marginTop: 8, fontSize: 13 }}>Searching…</div>}
        {err && <div style={{ marginTop: 8, fontSize: 13, color: "#b00020" }}>{err}</div>}
      </div>

      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", background: "#fafafa" }}>
          <div style={{ padding: "10px 12px", fontWeight: 900, fontSize: 13 }}>Code</div>
          <div style={{ padding: "10px 12px", fontWeight: 900, fontSize: 13 }}>Name</div>
        </div>

        {hasRows ? (
          rows.map((r, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderTop: "1px solid #eee" }}>
              <div style={{ padding: "10px 12px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>
                {r.code || "—"}
              </div>
              <div style={{ padding: "10px 12px", fontSize: 13 }}>{r.name || "—"}</div>
            </div>
          ))
        ) : (
          <div style={{ padding: "10px 12px", color: "#666" }}>No results yet.</div>
        )}
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Raw API response</summary>
        <pre
          style={{
            marginTop: 10,
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            maxHeight: 360,
            overflow: "auto",
            fontSize: 12,
          }}
        >
          {raw ? JSON.stringify(raw, null, 2) : "—"}
        </pre>
      </details>
    </div>
  );
}