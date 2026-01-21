// src/pages/ReviewPage.jsx
import { useEffect, useMemo, useState } from "react";
import { getMappings, deleteMapping } from "../api/mappingsClient";
import { authorizeMapping } from "../api/reviewClient";

export default function ReviewPage({ onNavigate, onEditAnchor }) {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [status, setStatus] = useState(null);

  // search controls
  const [scope, setScope] = useState("all"); // all | authorized | not_authorized
  const [searchField, setSearchField] = useState("anchor"); // anchor | substitute
  const [q, setQ] = useState("");

  // selection
  const [selectedRxcui, setSelectedRxcui] = useState(null);

  // auth controls
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("adminKey") || "");
  const [actor, setActor] = useState(() => localStorage.getItem("reviewActor") || "");
  const [reason, setReason] = useState("");

  async function refresh() {
    setErr(null);
    setStatus(null);
    setLoading(true);
    try {
      const data = await getMappings();
      setMappings(data || []);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = mappings;

    if (scope === "authorized") {
      list = list.filter((m) => (m.status || "draft") === "authorized");
    } else if (scope === "not_authorized") {
      list = list.filter((m) => (m.status || "draft") !== "authorized");
    }

    const query = q.trim().toLowerCase();
    if (!query) return list;

    return list.filter((m) => {
      const anchorName = (m.anchor_name || "").toLowerCase();
      const subName = ((m.substitutes?.[0]?.name) || "").toLowerCase();

      if (searchField === "anchor") return anchorName.includes(query);
      return subName.includes(query);
    });
  }, [mappings, scope, searchField, q]);

  const selected = useMemo(() => {
    if (!selectedRxcui) return null;
    return mappings.find((m) => m.anchor_rxcui === selectedRxcui) || null;
  }, [mappings, selectedRxcui]);

async function onAuthorize() {
  console.log("Authorize click fired");
  setErr(null);
  setStatus("Authorizing…");

  try {
    if (!selected?.anchor_rxcui) throw new Error("No mapping selected.");
    if (!adminKey.trim()) throw new Error("Admin key is required to authorize.");
    if (!actor.trim()) throw new Error("Please enter your name (actor) for the authorization stamp.");

    localStorage.setItem("adminKey", adminKey);
    localStorage.setItem("reviewActor", actor);

    console.log("Calling authorizeMapping for", selected.anchor_rxcui);

    const resp = await authorizeMapping(selected.anchor_rxcui, {
      adminKey,
      actor,
      reason,
    });

    console.log("authorizeMapping response:", resp);

    setStatus("Authorized ✅");
    setReason("");

    await refresh();
    setSelectedRxcui(selected.anchor_rxcui);
  } catch (e) {
    console.error("Authorize failed:", e);
    setStatus(null);
    setErr(e);
    alert(`Authorize failed: ${e.message}`);
  }
}

  async function onDelete() {
    if (!selected?.anchor_rxcui) return;
    const ok = window.confirm(`Delete mapping for "${selected.anchor_name}"?`);
    if (!ok) return;
    try {
      await deleteMapping(selected.anchor_rxcui);
      setSelectedRxcui(null);
      setStatus("Deleted.");
      await refresh();
    } catch (e) {
      setErr(e);
    }
  }

  if (loading) return <div style={{ opacity: 0.8 }}>Loading review queue…</div>;
// keep the page visible; show errors inline instead
// if (err) return <div style={{ color: "red" }}>Error: {err.message}</div>;

const isAuthorized = (selected?.status || "draft") === "authorized";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Review & Authorization</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 12 }}>
            Scope&nbsp;
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              style={{ padding: 6, borderRadius: 8, border: "1px solid #ccc", marginLeft: 6 }}
            >
              <option value="all">all</option>
              <option value="authorized">authorized only</option>
              <option value="not_authorized">not authorized</option>
            </select>
          </label>

          <label style={{ fontSize: 12 }}>
            Search field&nbsp;
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              style={{ padding: 6, borderRadius: 8, border: "1px solid #ccc", marginLeft: 6 }}
            >
              <option value="anchor">anchor</option>
              <option value="substitute">substitute</option>
            </select>
          </label>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            style={{
              flex: 1,
              minWidth: 220,
              padding: 8,
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 13,
            }}
          />

          <div style={{ fontSize: 12, opacity: 0.7 }}>{filtered.length} results</div>
        </div>

        {status && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>{status}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 12 }}>
        {/* LEFT: results */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fcfcfc", overflow: "hidden" }}>
          <div
            style={{
              padding: 10,
              borderBottom: "1px solid #eee",
              background: "white",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Results
          </div>

          <div
            style={{
              maxHeight: "70vh",
              overflowY: "auto",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>No matches.</div>
            ) : (
              filtered.map((m) => {
                const isSelected = m.anchor_rxcui === selectedRxcui;
                const isAuth = (m.status || "draft") === "authorized";
                return (
                  <div
                    key={m.anchor_rxcui}
                    style={{
                      border: `1px solid ${isSelected ? "#0070f3" : "#eee"}`,
                      background: isSelected ? "#f0f7ff" : "white",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{m.anchor_name || m.anchor_rxcui}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      → {m.substitutes?.[0]?.name || "(no substitute)"}
                    </div>

                    <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid #ddd",
                          background: isAuth ? "#eaffea" : "#fff7e6",
                        }}
                      >
                        {isAuth ? "authorized" : "draft"}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedRxcui(m.anchor_rxcui)}
                        style={{
                          marginLeft: "auto",
                          padding: "4px 8px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Select
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: detail */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, background: "white", padding: 14, minHeight: "70vh" }}>
          {!selected ? (
            <div style={{ fontSize: 13, opacity: 0.75 }}>Select a mapping on the left.</div>
          ) : (
            <>
              {/* Anchor -> TO -> Substitute */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>{selected.anchor_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    RxCUI {selected.anchor_rxcui} · TTY {selected.anchor_tty || "—"}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    opacity: 0.6,
                  }}
                >
                  TO
                </div>

                <div>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>
                    {selected.substitutes?.[0]?.name || "(no substitute)"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    RxCUI {selected.substitutes?.[0]?.rxcui || "—"} · TTY {selected.substitutes?.[0]?.tty || "—"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                Status: <strong>{selected.status || "draft"}</strong>
                {selected.authorized_by ? (
                  <>
                    {" "}
                    · Authorized by <strong>{selected.authorized_by}</strong> at{" "}
                    <strong>{selected.authorized_at}</strong>
                  </>
                ) : null}
              </div>

              {/* Evidence */}
              <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fcfcfc" }}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Evidence nuggets</div>
                {Array.isArray(selected.evidence_nuggets) && selected.evidence_nuggets.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {selected.evidence_nuggets.map((n, idx) => (
                      <div
                        key={n.id || idx}
                        style={{ border: "1px solid #eaeaea", borderRadius: 10, background: "white", padding: 10 }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{n.title || `Nugget ${idx + 1}`}</div>
                        {n.detail ? (
                          <div style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap", opacity: 0.85 }}>
                            {n.detail}
                          </div>
                        ) : (
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>(No detail provided)</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>(No evidence nuggets)</div>
                )}
              </div>

              {/* Authorization controls */}
              <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Actions</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ fontSize: 12 }}>
                    Admin key
                    <input
                      value={adminKey}
                      onChange={(e) => setAdminKey(e.target.value)}
                      placeholder="formulary-dev-admin-2026"
                      style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #ccc" }}
                    />
                  </label>

                  <label style={{ fontSize: 12 }}>
                    Your name (actor)
                    <input
                      value={actor}
                      onChange={(e) => setActor(e.target.value)}
                      placeholder="e.g., martin"
                      style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #ccc" }}
                    />
                  </label>
                </div>

                <label style={{ fontSize: 12, display: "block", marginTop: 10 }}>
                  Reason (optional)
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., P&T approved Jan 2026"
                    style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </label>

                {err && <div style={{ marginTop: 10, color: "red", fontSize: 13 }}>Error: {err.message}</div>}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={onAuthorize}
                    disabled={(selected.status || "draft") === "authorized"}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #28a745",
                      background: (selected.status || "draft") === "authorized" ? "#b7e1c1" : "#28a745",
                      color: "white",
                      cursor: (selected.status || "draft") === "authorized" ? "default" : "pointer",
                      fontSize: 13,
                      fontWeight: 800,
                      opacity: (selected.status || "draft") === "authorized" ? 0.85 : 1,
                    }}
                  >
                    {(selected.status || "draft") === "authorized" ? "Authorized" : "Authorize"}
                  </button>

                  <button
  type="button"
  onClick={() => onEditAnchor?.(selected.anchor_rxcui)}
  ///disabled={isAuthorized}
  style={{
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #0070f3",
    background: "white",
    color: "#0070f3",
    cursor: isAuthorized ? "default" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    opacity: isAuthorized ? 0.5 : 1,
  }}
>
  Edit
</button>

                  <button
                    type="button"
                    onClick={onDelete}
                    style={{
                      marginLeft: "auto",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #c00",
                      background: "white",
                      color: "#c00",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Delete
                  </button>
                </div>

                <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7 }}>
                  Note: Authorization is one mapping at a time to reinforce safe governance practices.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}