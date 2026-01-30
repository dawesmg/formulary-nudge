import { useState } from "react";
import OrgPolicyPage from "./pages/OrgPolicyPage.jsx";
import MappingEditorPage from "./pages/MappingEditorPage.jsx";
import ReviewPage from "./pages/ReviewPage.jsx";
import PrescribingPage from "./pages/PrescribingPage";


import Icd10LookupLab from "./pages/Icd10LookupLab.jsx";

const tabs = [
  { key: "match", label: "Prescribing" },
   { key: "policy", label: "Organisation Policy" },
  { key: "mappings", label: "Substitution Authoring" },
  { key: "review", label: "Review & Authorization" },
 
];


export default function App() {
  const [tab, setTab] = useState("policy");


  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px" }}>
      


      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: tab === t.key ? "#f0f7ff" : "white",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
{tab === "icd10" && <Icd10LookupLab />}

           {tab === "policy" && <OrgPolicyPage />}

      {tab === "mappings" && (
        <MappingEditorPage
          onNavigate={(nextTab) => setTab(nextTab)}
        />
      )}

      {tab === "review" && (
        <ReviewPage
          onNavigate={(nextTab) => setTab(nextTab)}
          onEditAnchor={(anchor_rxcui) => {
            // store the anchor to open in editor, then navigate
            localStorage.setItem("openAnchorRxcui", anchor_rxcui);
            setTab("mappings");
          }}
        />
      )}

      {tab === "match" && <PrescribingPage />}

    </div>
  );
}