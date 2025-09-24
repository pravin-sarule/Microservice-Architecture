
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");

// const router = express.Router();

// router.use(
//   "/auth",
//   createProxyMiddleware({
//     target: process.env.AUTH_SERVICE_URL || "https://auth-service-w1eg.onrender.com",
//     changeOrigin: true,
//     pathRewrite: {
//       "^/auth": "/api/auth" // frontend /auth/login → service /api/auth/login
//     },
//   })
// );

// module.exports = router;


const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");
const router = express.Router();

const targetAuth = process.env.AUTH_SERVICE_URL || "https://auth-service-w1eg.onrender.com";

router.use(
  "/auth",
  createProxyMiddleware({
    target: targetAuth,
    changeOrigin: true,
    pathRewrite: {
      "^/auth": "", // remove /auth from the URL, forward as /api/auth/login
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log("[GATEWAY] Proxying to:", targetAuth + proxyReq.path);
    },
    onError: (err, req, res) => {
      console.error("[GATEWAY] Proxy error:", err.message);
      res.status(502).send("Bad Gateway - auth service unreachable");
    },
  })
);

module.exports = router;
