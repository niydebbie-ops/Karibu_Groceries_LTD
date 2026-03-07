const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const connectDB = require("./utils/db");
const cors = require("cors");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const frontendDir = path.resolve(__dirname, "../../frontend");
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json());

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/procurement", require("./routes/procurement.routes"));
app.use("/api/stock", require("./routes/stock.routes"));
app.use("/api/sales", require("./routes/sales.routes"));
app.use("/api/credit", require("./routes/credit.routes"));
app.use("/api/reports", require("./routes/reports.routes"));
app.use("/api/branches", require("./routes/branch.routes"));
app.use("/api/director", require("./routes/director.routes"));

if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDir, "login.html"));
  });
}

app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "Server is working" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(500).json({ success: false, message: err.message });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
