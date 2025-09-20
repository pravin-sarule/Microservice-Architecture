const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const router = express.Router();

// 🔔 Middleware to log all payment-related requests
router.use((req, res, next) => {
  console.log(`🔔 Payment Proxy - Incoming Request: ${req.method} ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// Proxy /plans requests to Payment Service
router.use(
  "/plans", // Match /plans and its sub-paths
  createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
    changeOrigin: true,
    pathRewrite: {
      "^/plans": "/api/payments/plans", // Rewrite gateway prefix → service prefix
    },
    logLevel: "debug", // shows proxy details
    proxyTimeout: 60000,
    timeout: 60000,
    onError: (err, req, res) => {
      console.error("Payment service proxy error for /plans:", err.message);
      res.status(500).json({ error: "Payment Service is unavailable" });
    },
  })
);

// Proxy all /payments requests to Payment Service
router.use(
  "/payments", // Use router.use to match /payments and its sub-paths
  createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
    changeOrigin: true,
    pathRewrite: {
      "^/payments": "/api/payments", // Rewrite gateway prefix → service prefix
    },
    logLevel: "debug", // shows proxy details
    proxyTimeout: 60000,
    timeout: 60000,
    onError: (err, req, res) => {
      console.error("Payment service proxy error:", err.message);
      res.status(500).json({ error: "Payment Service is unavailable" });
    },
  })
);

module.exports = router;