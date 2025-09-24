// const express = require("express");
// const bodyParser = require("body-parser");
// const cors = require("cors");
// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcrypt");
// const { Pool } = require("pg");
// const dotenv = require("dotenv");

// dotenv.config();
// const pool = require("./src/config/db.js"); // Import the database connection
// const authRoutes = require("./src/routes/authRoutes"); // Import auth routes

// const app = express();
// const PORT = process.env.PORT || 5001;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json({ limit: "10mb" }));
// app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// // Health check
// app.get("/health", (req, res) => {
//   res.json({ status: "Auth Service is running" });
// });


// // Auth routes
// app.use("/api/auth", authRoutes);

// // Error handling middleware
// app.use((err, req, res, next) => {
//   if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
//     console.error("Bad JSON:", err.message);
//     return res.status(400).send({ message: "Invalid JSON payload" });
//   }
//   console.error(err.stack);
//   res.status(500).send("Something broke!");
// });

// // Auth routes
// app.use("/api/auth", authRoutes);

// // Start server
// app.listen(PORT, () => {
//   console.log(`Auth Service running on port ${PORT}`);
// });
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config();
const authRoutes = require("./src/routes/authRoutes"); // your auth routes
const pool = require("./src/config/db.js"); // your Postgres pool

const app = express();
const PORT = process.env.PORT || 5001;

// --------- CORS Setup ---------
const allowedOrigins = ["https://nexintel.netlify.app"];
app.use(cors({
  origin: allowedOrigins,
  credentials: true, // Allow cookies/Authorization header
}));

// --------- Middleware ---------
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// --------- Health Check ---------
app.get("/health", (req, res) => {
  res.json({ status: "Auth Service is running" });
});

// --------- Auth Routes ---------
app.use("/api/auth", authRoutes);

// --------- Error Handler ---------
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("Bad JSON:", err.message);
    return res.status(400).send({ message: "Invalid JSON payload" });
  }
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// --------- Start Server ---------
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
