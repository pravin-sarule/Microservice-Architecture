const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const authProxy = require("./routes/authProxy");
const fileProxy = require("./routes/fileProxy");
const paymentProxy = require("./routes/paymentProxy");
const supportProxy = require("./routes/supportProxy");
const draftProxy = require("./routes/draftProxy");

const app = express();

// Allow cross-origin requests
app.use(cors());

// Add a simple logger to see incoming requests before proxying
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

module.exports = app;
// });

// // Mount proxies
// app.use(authProxy);
// app.use(fileProxy);
// app.use(paymentProxy);
// // app.use(supportProxy);
// app.use("/support", supportProxy);
// app.use(draftProxy);

// // Centralized error handler
// // app.use(errorHandler);

// module.exports = app;


// // src/app.js
// const express = require("express");
// const cors = require("cors");
// const dotenv = require("dotenv");

// dotenv.config();

// const authProxy = require("./routes/authProxy");
// const fileProxy = require("./routes/fileProxy");
// const paymentProxy = require("./routes/paymentProxy");
// const supportProxy = require("./routes/supportProxy");
// const draftProxy = require("./routes/draftProxy");

// const app = express();

// // Allow cross-origin requests
// app.use(cors());

// // Logger
// app.use((req, res, next) => {
//   console.log(`[Gateway] Incoming Request: ${req.method} ${req.originalUrl}`);
//   next();
// });

// // Health check
// app.get("/health", (req, res) => {
//   res.json({ status: "API Gateway is running" });
// });

// // Mount proxies
// app.use(authProxy);
// app.use(fileProxy);
// app.use(paymentProxy);
// app.use("/support", supportProxy);
// app.use(draftProxy);

// module.exports = app;
// src/routes/draftProxy.js
