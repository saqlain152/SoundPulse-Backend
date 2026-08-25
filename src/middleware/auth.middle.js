const jwt = require('jsonwebtoken');

function extractToken(req) {
  if (req.cookies?.token) return req.cookies.token;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Any authenticated user
function authuser(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });
  try {
    req.user = jwt.verify(token, process.env.Secret_Key);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Optionally authenticated (for public pages that show extra data if logged in)
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try { req.user = jwt.verify(token, process.env.Secret_Key); } catch {}
  }
  next();
}

// Only verified artists
function authartist(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.Secret_Key);
    if (decoded.role !== 'artist' && decoded.role !== 'admin')
      return res.status(403).json({ message: 'Forbidden: Verified artists only' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Admin only
function authadmin(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.Secret_Key);
    if (decoded.role !== 'admin')
      return res.status(403).json({ message: 'Admin access required' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { authuser, authartist, authadmin, optionalAuth };
