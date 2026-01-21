import "dotenv/config";
import express from "express";
import cors from "cors";
import outputRoutes from "./routes/output.js";
import orgPolicyRoutes from "./routes/orgPolicy.js";
import mappingsRoutes from "./routes/mappings.js";
import rxnormRoutes from "./routes/rxnorm.js";

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-admin-key", "x-actor"],
  })
);

app.options(/.*/, cors());
app.use(express.json());



app.use("/api/output", outputRoutes);
app.use("/api/org-policy", orgPolicyRoutes);
app.use("/api/mappings", mappingsRoutes);
app.use("/api/rxnorm", rxnormRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const LISTEN_PORT = process.env.PORT || PORT;

app.listen(LISTEN_PORT, () => {
  console.log(`✔ Formulary Nudge API running on port ${LISTEN_PORT}`);
});