// Minimal in-memory sliding-window rate limiter — no extra dependency needed.
// Good enough for a single-instance deployment; swap for a Redis-backed
// limiter (e.g. rate-limiter-flexible) if you scale to multiple instances.

function makeLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> [timestamps]

  // Periodic cleanup so the map doesn't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const fresh = timestamps.filter(t => now - t < windowMs);
      if (fresh.length) hits.set(key, fresh);
      else hits.delete(key);
    }
  }, windowMs).unref?.();

  return function rateLimit(req, res, next) {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs);
    timestamps.push(now);
    hits.set(key, timestamps);

    if (timestamps.length > max) {
      return res.status(429).json({ message: 'Too many attempts. Please wait a moment and try again.' });
    }
    next();
  };
}

// Auth endpoints (magic-link request/verify, Google): 20 requests / 10 min per IP
const authLimiter = makeLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

module.exports = { authLimiter, makeLimiter };
