// server/services/auth.js
export function requireAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"];

  if (!key) {
    return res.status(403).json({ error: "Missing x-admin-key header" });
  }

  if (key !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: "Invalid admin key" });
  }

  // ✅ THIS was missing
  return next();
}