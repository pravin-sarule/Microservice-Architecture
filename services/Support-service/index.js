const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

require('dotenv').config({ path: './.env' });



const supportRoutes = require('./routes/supportRoutes');


const app = express();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

// ✅ Allowed origins
const allowedOrigins = ['https://nexinteluser.netlify.app', 'http://localhost:5173']; // Add your frontend URLs

// ✅ CORS setup
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser tools like Postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

// ✅ Handle preflight requests for all routes
// app.options('*', cors());

// Routes

app.use('/api/support', supportRoutes);


// Test route
app.get('/api/test-route', (req, res) => {
  res.send('Test route is working!');
});

const PORT = process.env.PORT || 3000;



    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });




// Graceful shutdown
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  process.exit(1);
});
