// // Routes forwarded to Auth Service

// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");

// const router = express.Router();

// router.use(
//   "/auth",
//   createProxyMiddleware({
//     target: process.env.AUTH_SERVICE_URL,
//     changeOrigin: true,
//     pathRewrite: { "^/auth": "" }, // /auth/login -> /login
//   })
// );

// module.exports = router;
// routes/authProxy.js

// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");

// const router = express.Router();

// router.use(
//   "/auth",
//   createProxyMiddleware({
//     target: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
//     changeOrigin: true,
//     // No pathRewrite needed because service already expects /auth/*
//   })
// );

// module.exports = router;
// routes/authProxy.js
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");

// const router = express.Router();

// router.use(
//   "/auth",
//   createProxyMiddleware({
//     target: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
//     changeOrigin: true,
//     pathRewrite: {
//       "^/auth": "/api/auth", // rewrites /auth/* → /api/auth/*
//     },
//   })
// );

// module.exports = router;
const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");

const router = express.Router();

// Forward /auth → AUTH_SERVICE
router.use(
  "/auth",
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
    changeOrigin: true,
    pathRewrite: { "^/auth": "/api/auth" }, // e.g. /auth/login → /api/auth/login
  })
);

module.exports = router;
