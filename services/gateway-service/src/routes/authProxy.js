
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
