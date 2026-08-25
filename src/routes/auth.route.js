const express  = require('express');
const multer   = require('multer');
const auth     = require('../controller/auth.controller');
const { authuser, authadmin, optionalAuth } = require('../middleware/auth.middle');
const { authLimiter } = require('../middleware/rateLimit.middle');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB for avatar/cover images
});
const router = express.Router();

// Public authentication
router.post('/register',     authLimiter, auth.register);
router.post('/resend-verification', authLimiter, auth.resendVerification);
router.post('/login',        authLimiter, auth.login);
router.post('/forgot-password', authLimiter, auth.forgotPassword);
router.post('/reset-password',  authLimiter, auth.resetPassword);
router.post('/email/request', authLimiter, auth.requestEmailLink);
router.post('/email/verify',  authLimiter, auth.verifyEmailLink);
router.post('/google',        authLimiter, auth.googleAuth);
router.post('/logout',        auth.logout);

// Authenticated
router.get('/me',            authuser, auth.getMe);
router.get('/following',     authuser, auth.getFollowingArtists);
router.post('/apply-artist', authuser, auth.applyArtist);
router.put('/profile',       authuser, upload.fields([
  { name: 'avatar',     maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'profilePic', maxCount: 1 },
]), auth.updateProfile);

// Public profile (optional auth, so we can show follow status)
router.get('/artist/:userId',       optionalAuth, auth.getProfileById);
router.post('/artist/:userId/follow', authuser, auth.toggleFollow);

// Admin (never surfaced as a user-facing signup path — this exists purely
// to review artist applications and moderate accounts)
router.get('/admin/users',               authadmin, auth.getAllUsers);
router.get('/admin/applications',        authadmin, auth.getApplications);
router.post('/admin/review-application', authadmin, auth.reviewApplication);

module.exports = router;
