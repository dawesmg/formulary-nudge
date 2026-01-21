import fs from "fs";
import path from "path";

export function readJson(fileName, defaultValue = null) {
  const filePath = path.join(process.cwd(), "data", fileName);
  if (!fs.existsSync(filePath)) return defaultValue;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(fileName, data) {
  const filePath = path.join(process.cwd(), "data", fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}