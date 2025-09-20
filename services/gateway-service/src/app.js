

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
console.log(`[Gateway] PAYMENT_SERVICE_URL: ${process.env.PAYMENT_SERVICE_URL}`);

const authProxy = require("./routes/authProxy");
const fileProxy = require("./routes/fileProxy");
const paymentProxy = require("./routes/paymentProxy");
const supportProxy = require("./routes/supportProxy");
const draftProxy = require("./routes/draftProxy");

const app = express();

const allowedOrigins = ["http://localhost:5173", "http://localhost:5000"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

// Simple logger to see incoming requests
app.use((req, res, next) => {
  console.log(`[Gateway] Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "API Gateway is running" });
});

// Mount proxies
app.use(authProxy);
app.use(fileProxy);
app.use(paymentProxy);
app.use("/support", supportProxy);
app.use("/drafting", draftProxy);

// Catch-all for 404 errors
app.use((req, res, next) => {
  console.log(`[Gateway] 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// General error handler
app.use((err, req, res, next) => {
  console.error("[Gateway] Unhandled Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

module.exports = app;
