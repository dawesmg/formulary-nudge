import { useEffect, useState } from "react";

export default function AdminKeyBar({
  actor,
  setActor,
  adminKey,
  setAdminKey,
  label = "Admin controls",
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        background: "#fafafa",
        display: "grid",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 4 }}>
            Actor
          </div>
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="e.g., Martin"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontSize: 13,
              background: "white",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 4 }}>
            Admin key
          </div>
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Paste admin key…"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontSize: 13,
              background: "white",
              boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            Stored in this tab only (sessionStorage).
          </div>
        </div>
      </div>
    </div>
  );
}