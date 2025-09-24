


// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");
// const { authMiddleware } = require("../middlewares/authMiddleware");

// const router = express.Router();

// // Debug log before proxying
// router.use("/files", (req, res, next) => {
//   console.log("Gateway received:", req.method, req.originalUrl);
//   next();
// });

// // Protect all /files and /docs routes with JWT
// router.use("/files", authMiddleware);
// router.use("/docs", authMiddleware);

// // Proxy: /files/* → File Service /api/doc/*
// router.use(
//   "/files",
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL || "https://document-service-hnk7.onrender.com",
//     changeOrigin: true,
//     pathRewrite: { "^/files": "/api/doc" },
//     onProxyReq: (proxyReq, req) => {
//       if (req.user && req.user.id) {
//         proxyReq.setHeader("x-user-id", req.user.id);
//       }
//     },
//     logLevel: "debug",
//     proxyTimeout: 60000,
//     timeout: 60000,
//     onError: (err, req, res) => {
//       console.error("File service proxy error:", err.message);
//       res.status(500).json({ error: "File Service is unavailable" });
//     },
//   })
// );

// // Proxy: /docs/* → File Service /api/files/*
// router.use(
//   "/docs",
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL || "https://document-service-hnk7.onrender.com",
//     changeOrigin: true,
//     pathRewrite: { "^/docs": "/api/files" },
//     onProxyReq: (proxyReq, req) => {
//       if (req.user && req.user.id) {
//         proxyReq.setHeader("x-user-id", req.user.id);
//       }
//     },
//     logLevel: "debug",
//     proxyTimeout: 60000,
//     timeout: 60000,
//     onError: (err, req, res) => {
//       console.error("File service proxy error:", err.message);
//       res.status(500).json({ error: "File Service is unavailable" });
//     },
//   })
// );

// module.exports = router;
const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// Debug log before proxying
router.use(["/files", "/docs", "/documents"], (req, res, next) => {
  console.log("Gateway received:", req.method, req.originalUrl);
  next();
});

// Protect all routes with JWT
router.use(["/files", "/docs", "/documents"], authMiddleware);

// Proxy /files/* → /api/doc/*
router.use(
  ["/files", "/documents"], // /documents is an alias for files
  createProxyMiddleware({
    target: process.env.FILE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/files": "/api/doc",
      "^/documents": "/api/doc",
    },
    onProxyReq: (proxyReq, req) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
      }
    },
    logLevel: "debug",
    proxyTimeout: 60000,
    timeout: 60000,
    onError: (err, req, res) => {
      console.error("File service proxy error:", err.message);
      res.status(500).json({ error: "File Service is unavailable" });
    },
  })
);

// Proxy /docs/* → /api/files/*
router.use(
  "/docs",
  createProxyMiddleware({
    target: process.env.FILE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/docs": "/api/files" },
    onProxyReq: (proxyReq, req) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
      }
    },
    logLevel: "debug",
    proxyTimeout: 60000,
    timeout: 60000,
    onError: (err, req, res) => {
      console.error("File service proxy error:", err.message);
      res.status(500).json({ error: "File Service is unavailable" });
    },
  })
);

module.exports = router;
