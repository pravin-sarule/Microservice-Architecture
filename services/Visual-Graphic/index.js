const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: './.env' });

// Routes
const infographicRoutes = require('./routes/infographicRoutes');

const app = express();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://jurinex.netlify.app',
  'https://microservicefrontend.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or same-server requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-user-id'
  ]
}));

// Routes
app.use('/api/infographic', infographicRoutes);

// Test route
app.get('/api/test-route', (req, res) => {
  res.send('✅ Visual Graphic Service is working!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'visual-graphic-service',
    timestamp: new Date().toISOString()
  });
});

// Use the PORT provided by Cloud Run, default to 8082
const PORT = process.env.PORT || 8082;

app.listen(PORT, () => {
  console.log(`✅ Visual Graphic Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});



