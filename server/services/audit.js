import fs from "fs";
import path from "path";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

export function appendAudit(entry) {
  const line = JSON.stringify(entry);

  fs.appendFileSync(AUDIT_FILE, line + "\n", "utf8");
}