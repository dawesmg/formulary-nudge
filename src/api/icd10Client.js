export async function searchConditionsICD9(terms, maxList = 10, signal) {
  const q = String(terms || "").trim();
  if (q.length < 2) return []; // guardrail

  const url =
    `https://clinicaltables.nlm.nih.gov/api/icd9cm_dx/v3/search` +
    `?terms=${encodeURIComponent(q)}` +
    `&sf=short_name,long_name` +
    `&df=code_dotted,long_name` +
    `&maxList=${maxList}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`ICD-9 lookup failed (${res.status})`);
  }

  const data = await res.json();

  // data[3] = display rows
  const displayRows = Array.isArray(data?.[3]) ? data[3] : [];

  return displayRows.map(row => ({
    code: row?.[0] ?? null,   // e.g. "714.0"
    name: row?.[1] ?? "",    // e.g. "Rheumatoid arthritis"
  }));
}