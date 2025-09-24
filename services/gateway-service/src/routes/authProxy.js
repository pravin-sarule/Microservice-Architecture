
const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");

const router = express.Router();

router.use(
  "/auth",
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || "https://auth-service-w1eg.onrender.com",
    changeOrigin: true,
    pathRewrite: {
      "^/auth": "/api/auth" // frontend /auth/login → service /api/auth/login
    },
  })
);

module.exports = router;


// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");

// const router = express.Router();

// // Proxy /auth requests to the Auth Service
// router.use(
//   "/api/auth",
//   createProxyMiddleware({
//     target: process.env.AUTH_SERVICE_URL || "https://auth-service-w1eg.onrender.com",
//     changeOrigin: true,
//     pathRewrite: {
//       "^/api/auth": "/api/auth" // frontend /api/auth/login → service /api/auth/login
//     },
//     onProxyReq: (proxyReq, req, res) => {
//       console.log(`[Gateway] Proxying ${req.method} ${req.originalUrl} → ${proxyReq.path}`);
//     },
//     onError: (err, req, res) => {
//       console.error(`[Gateway] Proxy error for ${req.originalUrl}:`, err.message);
//       res.status(500).json({ error: "Proxy error", message: err.message });
//     },
//   })
// );

// module.exports = router;
