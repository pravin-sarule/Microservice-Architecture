


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
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");
// const { authMiddleware } = require("../middlewares/authMiddleware");

// const router = express.Router();

// // Debug log before proxying
// router.use(["/files", "/docs", "/documents"], (req, res, next) => {
//   console.log("Gateway received:", req.method, req.originalUrl);
//   next();
// });

// // Protect all routes with JWT
// router.use(["/files", "/docs", "/documents"], authMiddleware);

// // Proxy /files/* → /api/doc/*
// router.use(
//   ["/files", "/documents"], // /documents is an alias for files
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL,
//     changeOrigin: true,
//     pathRewrite: {
//       "^/files": "/api/doc",
//       "^/documents": "/api/doc",
//     },
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

// // Proxy /docs/* → /api/files/*
// router.use(
//   "/docs",
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL,
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

// const { createProxyMiddleware } = require("http-proxy-middleware");
// const express = require("express");
// const { authMiddleware } = require("../middlewares/authMiddleware");

// const router = express.Router();

// // Debug log before proxying
// router.use(["/files", "/docs", "/documents"], (req, res, next) => {
//   console.log("Gateway received:", req.method, req.originalUrl);
//   console.log("Target FILE_SERVICE_URL:", process.env.FILE_SERVICE_URL);
//   next();
// });

// // Protect all routes with JWT
// router.use(["/files", "/docs", "/documents"], authMiddleware);

// // Proxy /files/* → /api/doc/*
// router.use(
//   ["/files", "/documents"], // /documents is an alias for files
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL,
//     changeOrigin: true,
//     secure: true, // Add this for HTTPS targets
//     pathRewrite: {
//       "^/files": "/api/doc",
//       "^/documents": "/api/doc",
//     },
//     onProxyReq: (proxyReq, req) => {
//       console.log("Proxying to:", proxyReq.path);
      
//       // Forward user ID
//       if (req.user && req.user.id) {
//         proxyReq.setHeader("x-user-id", req.user.id);
//       }
      
//       // Ensure proper headers for JSON requests
//       if (req.get('content-type')) {
//         proxyReq.setHeader('content-type', req.get('content-type'));
//       }
      
//       // Handle body for POST/PUT requests
//       if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
//         const bodyData = JSON.stringify(req.body);
//         proxyReq.setHeader('Content-Type', 'application/json');
//         proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
//         proxyReq.write(bodyData);
//       }
//     },
//     onProxyRes: (proxyRes, req, res) => {
//       console.log('Received response from target:', proxyRes.statusCode);
//     },
//     logLevel: "debug",
//     proxyTimeout: 120000, // Increased timeout
//     timeout: 120000,
//     followRedirects: true,
//     onError: (err, req, res) => {
//       console.error("File service proxy error:", {
//         message: err.message,
//         code: err.code,
//         target: process.env.FILE_SERVICE_URL,
//         path: req.originalUrl,
//         method: req.method
//       });
      
//       if (!res.headersSent) {
//         res.status(502).json({ 
//           error: "File Service is unavailable",
//           details: process.env.NODE_ENV === 'development' ? err.message : undefined
//         });
//       }
//     },
//   })
// );

// // Proxy /docs/* → /api/files/*
// router.use(
//   "/docs",
//   createProxyMiddleware({
//     target: process.env.FILE_SERVICE_URL,
//     changeOrigin: true,
//     secure: true, // Add this for HTTPS targets
//     pathRewrite: { "^/docs": "/api/files" },
//     onProxyReq: (proxyReq, req) => {
//       console.log("Proxying docs to:", proxyReq.path);
      
//       // Forward user ID
//       if (req.user && req.user.id) {
//         proxyReq.setHeader("x-user-id", req.user.id);
//       }
      
//       // Ensure proper headers for JSON requests
//       if (req.get('content-type')) {
//         proxyReq.setHeader('content-type', req.get('content-type'));
//       }
      
//       // Handle body for POST/PUT requests
//       if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
//         const bodyData = JSON.stringify(req.body);
//         proxyReq.setHeader('Content-Type', 'application/json');
//         proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
//         proxyReq.write(bodyData);
//       }
//     },
//     onProxyRes: (proxyRes, req, res) => {
//       console.log('Received docs response from target:', proxyRes.statusCode);
//     },
//     logLevel: "debug",
//     proxyTimeout: 120000, // Increased timeout
//     timeout: 120000,
//     followRedirects: true,
//     onError: (err, req, res) => {
//       console.error("Docs service proxy error:", {
//         message: err.message,
//         code: err.code,
//         target: process.env.FILE_SERVICE_URL,
//         path: req.originalUrl,
//         method: req.method
//       });
      
//       if (!res.headersSent) {
//         res.status(502).json({ 
//           error: "Docs Service is unavailable",
//           details: process.env.NODE_ENV === 'development' ? err.message : undefined
//         });
//       }
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
