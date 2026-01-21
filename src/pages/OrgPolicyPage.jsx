import { useEffect, useMemo, useState } from "react";
import { getOrgPolicy, saveOrgPolicy } from "../api/orgPolicyClient";

const DEFAULT = {
  org_id: "ORG_001",
  alert_types: {
    formulary_substitution: {
      enabled: true,
      severity: "recommendation",
      timing: ["prescribing"],
      display_contexts: ["order-entry"],
      governance_required: true,
    },
  },
};

function isEmptyPolicy(p) {
  return (
    !p ||
    (typeof p === "object" &&
      !Array.isArray(p) &&
      Object.keys(p).length === 0)
  );
}

export default function OrgPolicyPage() {
  const [policy, setPolicy] = useState(null);
  const [loadedPolicy, setLoadedPolicy] = useState(null);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Viewer vs Editor mode
  const [editMode, setEditMode] = useState(false);

  // Demo governance helpers
  const [adminKey, setAdminKey] = useState(
    () => localStorage.getItem("adminKey") || ""
  );
  const [reason, setReason] = useState("");

  const creating = useMemo(() => isEmptyPolicy(loadedPolicy), [loadedPolicy]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      setStatus(null);

      try {
        const p = await getOrgPolicy();

        if (isEmptyPolicy(p)) {
          // No saved policy yet: start in edit mode to create it
          setPolicy(DEFAULT);
          setLoadedPolicy(p || {});
          setEditMode(true);
        } else {
          setPolicy(p);
          setLoadedPolicy(p);
          setEditMode(false); // viewer mode by default
        }
      } catch (e) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSave() {
  setStatus(null);
  setErr(null);

  if (!adminKey) {
    setErr(new Error("Admin key is required to save organisational policy."));
    return;
  }

  try {
    await saveOrgPolicy(policy, {
      adminKey,
      actor: "demo-admin",
      reason,
    });

    setStatus("Saved.");
    setEditMode(false);
    setReason("");
  } catch (e) {
    setErr(e);
  }
}

  function onCancel() {
    setErr(null);
    setStatus(null);

    if (creating) {
      // If we were creating (no policy existed), reset to defaults but stay in edit mode
      setPolicy(DEFAULT);
      setEditMode(true);
      return;
    }

    // Revert to last loaded snapshot and return to viewer mode
    setPolicy(loadedPolicy);
    setEditMode(false);
    setReason("");
  }

  if (loading) return <div style={{ opacity: 0.8 }}>Loading policy…</div>;
  if (err) return <div style={{ color: "red" }}>Error: {err.message}</div>;
  if (!policy) return null;

  const fs = policy.alert_types?.formulary_substitution || {};

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 14,
          background: "white",
        }}
      >
        {/* Header + mode buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {creating && editMode
              ? "Create Organisation Policy"
              : "Formulary Substitution Policy"}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {!editMode ? (
              <button
                type="button"
                onClick={() => {
                  setStatus(null);
                  setErr(null);
                  setEditMode(true);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSave}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #0070f3",
                    background: "#0070f3",
                    color: "white",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        {status && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {status}
          </div>
        )}

        {/* Viewer/edit hint */}
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
          {!editMode ? (
            <div>
              Viewing current organisational policy. Click <strong>Edit</strong> to make changes.
            </div>
          ) : (
            <div>
              Editing mode. Changes are saved to the organisation policy and audited.
            </div>
          )}
        </div>

        {/* Disable all controls unless editMode */}
        <fieldset
          disabled={!editMode}
          style={{ border: "none", padding: 0, marginTop: 12}}
        >
          {/* Enabled */}
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontSize: 13, fontWeight: 800,
            }}
          >
            <input
              type="checkbox"
              checked={!!fs.enabled}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  alert_types: {
                    ...p.alert_types,
                    formulary_substitution: {
                      ...fs,
                      enabled: e.target.checked,
                    },
                  },
                }))
              }
            />
            Enabled
          </label>

          {/* Enabled helper text */}
          <div
            style={{
              fontSize: 11,
              opacity: 0.7,
              marginTop: 6,
              marginLeft: 22,
              lineHeight: 1.4,
            }}
          >
            <div>
              Enables or disables formulary substitution suggestions across the
              organisation.
            </div>
            <div>• Off → no substitutions are generated anywhere</div>
            <div>• On → substitutions may be generated subject to other rules</div>
          </div>

          {/* Severity + Governance */}
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Severity */}
            <div>
              <label style={{ fontSize: 13 , fontWeight: 800}}>
                Severity&nbsp;
                <select
                  value={fs.severity || "recommendation"}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      alert_types: {
                        ...p.alert_types,
                        formulary_substitution: {
                          ...fs,
                          severity: e.target.value,
                        },
                      },
                    }))
                  }
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    marginLeft: 6,
                  }}
                >
                  <option value="informational">informational</option>
                  <option value="recommendation">recommendation</option>
                  <option value="warning">warning</option>
                  <option value="hard-stop">hard-stop</option>
                </select>
              </label>

              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, lineHeight: 1.45 }}>
                Defines how strongly substitution suggestions are presented to clinicians
                during prescribing.
                <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                  <li>
                    <strong>Informational</strong> — visible context only; no workflow interruption
                  </li>
                  <li>
                    <strong>Recommendation</strong> — actively suggested at order entry
                  </li>
                  <li>
                    <strong>Warning</strong> — requires acknowledgement before proceeding
                  </li>
                  <li>
                    <strong>Hard-stop</strong> — prescribing cannot continue without override or substitution
                  </li>
                </ul>
              </div>
            </div>

            {/* Governance */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 800}}>
                Governance required&nbsp;
                <select
                  value={fs.governance_required ? "yes" : "no"}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      alert_types: {
                        ...p.alert_types,
                        formulary_substitution: {
                          ...fs,
                          governance_required: e.target.value === "yes",
                        },
                      },
                    }))
                  }
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    marginLeft: 6,
                  }}
                >
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>

              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, lineHeight: 1.45 }}>
                Determines whether substitution rules must undergo review and approval
                before they can be activated or released into connected EHR systems.
                <div style={{ marginTop: 4 }}>
                  When enabled, new or modified substitution rules will be placed in a pending state until approved.
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* Admin key + reason (only in edit mode) */}
        {editMode && (
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 800}}>
              Admin key (required to save)
              <input
                type="password"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  localStorage.setItem("adminKey", e.target.value);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: 6,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 13,
                }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Reason for change (audit log)
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Annual formulary update"
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: 6,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 13,
                }}
              />
            </label>

            <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
              Policy updates are protected by an admin key and recorded in the audit log. For this demo version use this as the key: formulary-dev-admin-2026 
            </div>
          </div>
        )}
      </div>
    </div>
  );
}