// // Routes forwarded to File Service

// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");
// const { authMiddleware } = require("auth-middleware-package");

// const router = express.Router();

// // Protect all /files routes with JWT
// router.use(
//   "/files",
//   authMiddleware,
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL,
//     changeOrigin: true,
//     pathRewrite: { "^/files": "/api/documents" }, // /files/batch-upload -> /api/documents/batch-upload
//   })
// );

// module.exports = router;
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");
// const { authMiddleware } = require("auth-middleware-package"); // your JWT middleware

// const router = express.Router();

// // Apply auth middleware first
// router.use("/files", authMiddleware);

// // Then proxy all /files requests to File Service
// router.use(
//   "/files",
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL || "http://localhost:3000",
//     changeOrigin: true,
//     pathRewrite: { "^/files": "/api/documents" }, // map /files/* -> /api/documents/*
//   })
// );

// module.exports = router;
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");
// const { authMiddleware } = require("auth-middleware-package");

// const router = express.Router();

// // Apply JWT middleware first
// router.use("/files", authMiddleware);

// // Proxy all /files requests to Document Service
// router.use(
//   "/files",
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL || "http://localhost:5002",
//     changeOrigin: true,
//     pathRewrite: { "^/files": "/api/documents" }, // /files/batch-upload -> /api/documents/batch-upload
//     proxyTimeout: 60000,
//     timeout: 60000,
//     onError: (err, req, res) => {
//       console.error("Proxy error:", err);
//       res.status(500).json({ error: "Document Service is unavailable" });
//     },
//   })
// );

// module.exports = router;
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");
// const { authMiddleware } = require("auth-middleware-package");

// const router = express.Router();

// // Protect all file routes
// router.use("/files", authMiddleware);

// // Forward /files → FILE_SERVICE
// router.use(
//   "/files",
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL || "http://localhost:5002",
//     changeOrigin: true,
//     pathRewrite: { "^/files": "/api/documents" }, 
//     proxyTimeout: 60000,
//     timeout: 60000,
//     onError: (err, req, res) => {
//       console.error("File service proxy error:", err);
//       res.status(500).json({ error: "Document Service is unavailable" });
//     },
//   })
// );

// module.exports = router;


// src/routes/fileProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// Debug log before proxying
router.use("/files", (req, res, next) => {
  console.log("Gateway received:", req.method, req.originalUrl);
  next();
});

// Protect all /files routes with JWT
router.use("/files", authMiddleware);
router.use("/docs", authMiddleware);
// Proxy: /files/* → File Service /api/doc/*
router.use(
  "/files",
  createProxyMiddleware({
    target: process.env.FILE_SERVICE_URL || "http://localhost:5002",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/doc/", // Rewrite /batch-upload to /api/doc/batch-upload
    },
    onProxyReq: (proxyReq, req) => {
      // Inject user ID from JWT into header for Document Service
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
      }
    },
    logLevel: "debug", // shows proxy details
    proxyTimeout: 60000,
    timeout: 60000,
    onError: (err, req, res) => {
      console.error("File service proxy error:", err.message);
      res.status(500).json({ error: "File Service is unavailable" });
    },
  })
);

// Proxy: /files/* → File Service /api/doc/*
router.use(
  "/docs",
  createProxyMiddleware({
    target: process.env.FILE_SERVICE_URL || "http://localhost:5002",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/files/", // Rewrite /batch-upload to /api/doc/batch-upload
    },
    onProxyReq: (proxyReq, req) => {
      // Inject user ID from JWT into header for Document Service
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
      }
    },
    logLevel: "debug", // shows proxy details
    proxyTimeout: 60000,
    timeout: 60000,
    onError: (err, req, res) => {
      console.error("File service proxy error:", err.message);
      res.status(500).json({ error: "File Service is unavailable" });
    },
  })
);

module.exports = router;
