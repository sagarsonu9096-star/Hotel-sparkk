require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5000" }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120 }));
app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "Hotel Sparkk Deluxe API" }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ error: "A record with this value already exists." });
  res.status(500).json({ error: "Server error. Please try again." });
});

const port = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => console.log(`Hotel Sparkk server running on http://localhost:${port}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
