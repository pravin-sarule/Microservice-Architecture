import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "Auth Service is running" });
});


// Start server
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
