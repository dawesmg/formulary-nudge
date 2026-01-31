export default function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  const expected = process.env.ADMIN_KEY;

  if (!expected) {
    return res.status(500).json({ error: "ADMIN_KEY not set on server" });
  }

  if (!key || key !== expected) {
    return res.status(403).json({ error: "Admin authorization required" });
  }

  next();
}
