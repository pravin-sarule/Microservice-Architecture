
// const express = require('express');
// const morgan = require('morgan');
// const cors = require('cors');
// const cookieParser = require('cookie-parser');
// require('dotenv').config({ path: './.env' });

// // Routes
// const documentRoutes = require('./routes/documentRoutes');
// const chatRoutes = require('./routes/chatRoutes');
// const secretManagerRoutes = require('./routes/secretManagerRoutes');
// const fileRoutes = require('./routes/fileRoutes');
// const contentRoutes = require('./routes/contentRoutes');

// const app = express();

// // Middleware
// app.use(cookieParser());
// app.use(express.json());
// app.use(morgan('dev'));

// app.use(cors({
//   origin: 'http://localhost:5173', // or '*' for all origins
//   methods: ['GET','POST','PUT','DELETE','OPTIONS'],
//   credentials: true // if you need cookies or auth headers
// }));


// // Routes
// app.use('/api/doc', documentRoutes);
// app.use('/api/doc', chatRoutes);
// app.use('/api/doc', secretManagerRoutes);
// app.use('/api/files', fileRoutes);
// app.use('/api/content', contentRoutes);

// // Test route
// app.get('/api/test-route', (req, res) => {
//   res.send('Test route is working!');
// });

// // Use the PORT provided by Cloud Run, default to 8080
// const PORT = process.env.PORT || 5002;

// app.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });

// // Graceful shutdown
// process.on('unhandledRejection', (err) => {
//   console.error(`❌ Unhandled Rejection: ${err.message}`);
//   process.exit(1);
// });









const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: './.env' });

// Routes
const documentRoutes = require('./routes/documentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const secretManagerRoutes = require('./routes/secretManagerRoutes');
const fileRoutes = require('./routes/fileRoutes');

const app = express();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

app.use(cors({
  origin: 'http://localhost:5173', // or '*' for all origins
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  credentials: true // if you need cookies or auth headers
}));


// Routes
app.use('/api/doc', documentRoutes);
app.use('/api/doc', chatRoutes);
app.use('/api/doc', secretManagerRoutes);
app.use('/api/files', fileRoutes);

// Test route
app.get('/api/test-route', (req, res) => {
  res.send('Test route is working!');
});

// Use the PORT provided by Cloud Run, default to 8080
const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  process.exit(1);
});














