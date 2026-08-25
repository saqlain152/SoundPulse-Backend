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

const allowedOrigins = (
  process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ✅ CORS — allows frontend to communicate with backend
const express = require('express');
const cors = require('cors');

const app = express();

// Parse origins from process.env or fallback to defaults
const allowedOrigins = process.env.CLIENT_URLS 
  ? process.env.CLIENT_URLS.split(',').map(url => url.trim())
  : [
     'https://soundpulse-web.vercel.app',
     'http://localhost:5173'

     
    ];

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: ${origin} is not allowed`));
  },
  credentials: true, // Required for cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Defensive: express.json()/urlencoded() only populate req.body when the
// request actually has a matching Content-Type header. A client that omits
// it (or sends a bad one) would otherwise leave req.body `undefined` and
// crash any controller that destructures it — normalize to {} instead.
app.use((req, res, next) => { if (req.body === undefined) req.body = {}; next(); });
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.get('/api/search', search); // alias of GET /api/music/search, matches spec's top-level search route

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
