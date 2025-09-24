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
const dotenv = require("dotenv");

dotenv.config();
const pool = require("./src/config/db.js");
const authRoutes = require("./src/routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5001;

// ✅ CORS configuration
// const allowedOrigins = ["https://nexintel.netlify.app/"];
// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true);
//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }
//     return callback(new Error("Not allowed by CORS"));
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
// }));
const allowedOrigins = ["https://nexintel.netlify.app"]; // no trailing slash

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests like Postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
}));

// ✅ Handle preflight
app.options("*", cors());

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "Auth Service is running" });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("Bad JSON:", err.message);
    return res.status(400).send({ message: "Invalid JSON payload" });
  }
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
