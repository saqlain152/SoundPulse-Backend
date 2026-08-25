const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes     = require('./routes/auth.route');
const musicRoutes    = require('./routes/music.route');
const playlistRoutes = require('./routes/playlist.route');
const { search }     = require('./controller/music.controller');

dotenv.config();
const app = express();

// Set default fallback domains
const defaultOrigins = [
  'https://soundpulse-web.vercel.app',
  'http://localhost:5173'
];

// Read from Render env variables if present, otherwise merge defaults
const envOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

// CORS Middleware
app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: ${origin} is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Normalize empty req.body to prevent crashes
app.use((req, res, next) => { 
  if (req.body === undefined) req.body = {}; 
  next(); 
});

app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.get('/api/search', search);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: '🎵 Melodia API is running' });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

module.exports = app;