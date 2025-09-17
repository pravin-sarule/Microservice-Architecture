// // routes/paymentProxy.js
// const express = require("express");
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const { authMiddleware } = require("../middlewares/authMiddleware"); // your JWT middleware

// const router = express.Router();

// // 🔔 Middleware to log all payment-related requests
// router.use((req, res, next) => {
//   console.log(`🔔 Payment route accessed: ${req.method} ${req.originalUrl}`);
//   console.log("Headers:", req.headers);
//   console.log("Body:", req.body);
//   console.log("User from auth (if any):", req.user);
//   next();
// });

// // Apply JWT middleware before proxying
// // Health check for Rezorpay Proxy
// router.get("/payments/health", (req, res) => {
//   res.json({ status: "Rezorpay Proxy is running" });
// });

// // Test route to check payment service URL configuration
// router.get("/payments/test-config", (req, res) => {
//   res.json({
//     message: "Rezorpay Proxy configuration test",
//     PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
//   });
// });

// // Apply JWT middleware before proxying (for actual payment operations)
// // This should come after any unprotected health/test routes

// // Proxy all /payments requests to the Payment Service
// router.use(
//   "/payments",
//   createProxyMiddleware({
//     target: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
//     changeOrigin: true,
//     pathRewrite: { "^/payments": "" }, // strip /payments prefix
//     proxyTimeout: 60000,
//     timeout: 60000,
//     onError: (err, req, res) => {
//       console.error("Payment service proxy error:", err);
//       res.status(500).json({ error: "Payment Service is unavailable" });
//     },
//   })
// );

// router.use("/payments", authMiddleware); // Apply authMiddleware here

// module.exports = router;
// routes/paymentProxy.js
// const express = require("express");
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const { authMiddleware } = require("../middlewares/authMiddleware"); // JWT middleware

// const router = express.Router();

// // 🔔 Middleware to log all payment-related requests
// router.use((req, res, next) => {
//   console.log(`🔔 Payment route accessed: ${req.method} ${req.originalUrl}`);
//   console.log("Headers:", req.headers);
//   console.log("Body:", req.body);
//   console.log("User from auth (if any):", req.user);
//   next();
// });

// // ---------------------------
// // Public routes (no JWT required)
// // ---------------------------

// // Health check
// router.get("/payments/health", (req, res) => {
//   res.json({ status: "Payment Proxy is running" });
// });

// // Test configuration
// router.get("/payments/test-config", (req, res) => {
//   res.json({
//     message: "Payment Proxy configuration test",
//     PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
//   });
// });

// // ---------------------------
// // Protected routes (JWT required)
// // ---------------------------

// // Apply authMiddleware for all /payments except public routes
// router.use("/payments", authMiddleware);

// // Proxy all other /payments requests to Payment Service
// router.use(
//   "/payments",
//   createProxyMiddleware({
//     target: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
//     changeOrigin: true,
//     pathRewrite: { "^/payments": "" }, // strip /payments prefix
//     proxyTimeout: 60000,
//     timeout: 60000,
//     onError: (err, req, res) => {
//       console.error("Payment service proxy error:", err);
//       res.status(500).json({ error: "Payment Service is unavailable" });
//     },
//   })
// );

// module.exports = router;
const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// Protect all payment routes
router.use("/payments", authMiddleware);

// Forward /payments → PAYMENT_SERVICE
router.use(
  "/payments",
  createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
    changeOrigin: true,
    pathRewrite: { "^/payments": "/api/payments" }, // keep consistent with service
    proxyTimeout: 60000,
    timeout: 60000,
    onError: (err, req, res) => {
      console.error("Payment service proxy error:", err);
      res.status(500).json({ error: "Payment Service is unavailable" });
    },
  })
);

module.exports = router;
