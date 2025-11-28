// const express = require('express');
// const cors = require('cors');
// require('dotenv').config();

// // Initialize GCS configuration
// const { initializeGCS } = require('./config/gcs');
// const { checkSystemClock } = require('./utils/systemCheck');

// // Check system clock first (important for JWT tokens)
// checkSystemClock().then(clockStatus => {
//   if (!clockStatus.synchronized && clockStatus.differenceMinutes) {
//     console.error(`\n⚠️ CRITICAL: System clock is out of sync by ${clockStatus.differenceMinutes.toFixed(2)} minutes!`);
//     console.error('   This will cause JWT authentication errors with GCS.');
//     console.error('   Please sync your system clock before using GCS features.\n');
//   }
// });

// // Initialize GCS
// try {
//   initializeGCS();
// } catch (error) {
//   console.error('⚠️ Warning: GCS initialization failed. File uploads will not work:', error.message);
//   console.error('   Run: node scripts/test-gcs-credentials.js to diagnose the issue');
// }

// const chatRoutes = require('./routes/chatRoutes');

// const app = express();
// const PORT = process.env.PORT || 5003;

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: 'ChatModel service is running',
//     timestamp: new Date().toISOString()
//   });
// });

// // API Routes
// app.use('/api/chat', chatRoutes);

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Route not found'
//   });
// });

// // Error handler
// app.use((err, req, res, next) => {
//   console.error('❌ Error:', err);
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message || 'Internal server error'
//   });
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`🚀 ChatModel service running on port ${PORT}`);
//   console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
// });

// module.exports = app;




const express = require('express');
const cors = require('cors');
require('dotenv').config();

// -------------------------------
// ✅ ALLOWED ORIGINS FIX
// -------------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://jurinex.netlify.app"
];

// Initialize GCS configuration
const { initializeGCS } = require('./config/gcs');
const { checkSystemClock } = require('./utils/systemCheck');

// Check system clock first (important for JWT tokens)
checkSystemClock().then(clockStatus => {
  if (!clockStatus.synchronized && clockStatus.differenceMinutes) {
    console.error(`\n⚠️ CRITICAL: System clock is out of sync by ${clockStatus.differenceMinutes.toFixed(2)} minutes!`);
    console.error('   This will cause JWT authentication errors with GCS.');
    console.error('   Please sync your system clock before using GCS features.\n');
  }
});

// Initialize GCS
try {
  initializeGCS();
} catch (error) {
  console.error('⚠️ Warning: GCS initialization failed. File uploads will not work:', error.message);
  console.error('   Run: node scripts/test-gcs-credentials.js to diagnose the issue');
}

const chatRoutes = require('./routes/chatRoutes');

const app = express();
const PORT = process.env.PORT || 5003;

// -------------------------------
// ✅ UPDATED CORS MIDDLEWARE
// -------------------------------
app.use(cors({
  origin: function (origin, callback) {
    // Allow Postman / non-browser tools
    if (!origin) return callback(null, true);

    console.log("🌐 Incoming Origin:", origin);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------------
// ✔️ HEALTH CHECK
// -------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ChatModel service is running',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------
// ✔️ API ROUTES
// -------------------------------
app.use('/api/chat', chatRoutes);

// -------------------------------
// ❌ 404 HANDLER
// -------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// -------------------------------
// ❌ ERROR HANDLER
// -------------------------------
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// -------------------------------
// 🚀 START SERVER
// -------------------------------
app.listen(PORT, () => {
  console.log(`🚀 ChatModel service running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
