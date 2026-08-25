const crypto     = require('crypto');
const usermodel  = require('../model/user.model');
const musicModel = require('../model/music.model');
const albumModel = require('../model/album.model');
const jwt        = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { uploadFile } = require('../services/storage.services');
const {
  sendMagicLinkEmail,
  sendPasswordActionEmail,
  sendArtistApplicationEmail,
  sendArtistApplicationReceivedEmail,
  sendArtistApplicationReviewEmail,
} = require('../services/email.service');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function passwordMatches(password, storedHash) {
  const [salt, key] = String(storedHash || '').split(':');
  if (!salt || !key) return false;
  const candidate = await passwordHash(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate.split(':')[1], 'hex'), Buffer.from(key, 'hex'));
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

async function register(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!validPassword(password)) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    let user = await usermodel.findOne({ email });
    if (user) return res.status(409).json({ message: 'This email already has an account. Please go to Sign in and use your email and password.' });
    const hash = await passwordHash(password);
    if (!user) user = await usermodel.create({ username: usernameFromEmail(email), email, authMethod: 'email', passwordHash: hash });
    else { user.passwordHash = hash; user.authMethod = 'email'; }
    const token = crypto.randomBytes(32).toString('hex');
    user.magicLinkTokenHash = hashToken(token);
    user.magicLinkExpires = new Date(Date.now() + MAGIC_LINK_TTL_MS);
    user.magicLinkPurpose = 'verify';
    await user.save();
    await sendPasswordActionEmail(email, user.username, token, 'verify');
    res.json({ message: 'Check your email to verify your account.' });
  } catch (err) {
    console.error('register error:', err);
    res.status(502).json({ message: 'We could not send the verification email. Check the backend mail logs.' });
  }
}

async function login(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await usermodel.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash || !(await passwordMatches(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    if (!user.isEmailVerified) return res.status(403).json({ message: 'Verify your email before signing in.' });
    if (!user.isActive) return res.status(403).json({ message: 'Account suspended. Contact support.' });
    const token = signToken(user);
    res.cookie('token', token, cookieOpts());
    res.json({ message: 'Signed in!', token, user: userPayload(user) });
  } catch (err) { console.error('login error:', err); res.status(500).json({ message: 'Internal server error' }); }
}

async function resendVerification(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const user = await usermodel.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account was found for this email address.' });
    if (user.isEmailVerified) return res.status(400).json({ message: 'This account is already verified. You can sign in.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.magicLinkTokenHash = hashToken(token);
    user.magicLinkExpires = new Date(Date.now() + MAGIC_LINK_TTL_MS);
    user.magicLinkPurpose = 'verify';
    await user.save();
    await sendPasswordActionEmail(email, user.username, token, 'verify');

    res.json({ message: 'A new verification email has been sent.' });
  } catch (err) {
    console.error('resendVerification error:', err);
    res.status(502).json({ message: 'We could not resend the verification email. Please try again.' });
  }
}

async function forgotPassword(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await usermodel.findOne({ email });
    if (user?.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex');
      user.magicLinkTokenHash = hashToken(token);
      user.magicLinkExpires = new Date(Date.now() + MAGIC_LINK_TTL_MS);
      user.magicLinkPurpose = 'reset';
      await user.save();
      await sendPasswordActionEmail(email, user.username, token, 'reset');
    }
    res.json({ message: 'If an account exists for that email, a password reset link is on its way.' });
  } catch (err) { console.error('forgotPassword error:', err); res.status(502).json({ message: 'We could not send the reset email. Check the backend mail logs.' }); }
}

async function resetPassword(req, res) {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!validPassword(password)) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    const user = await usermodel.findOne({ magicLinkTokenHash: hashToken(token), magicLinkPurpose: 'reset', magicLinkExpires: { $gt: Date.now() } }).select('+magicLinkTokenHash +magicLinkExpires +magicLinkPurpose');
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or expired.' });
    user.passwordHash = await passwordHash(password);
    user.magicLinkTokenHash = '';
    user.magicLinkExpires = undefined;
    user.magicLinkPurpose = '';
    await user.save();
    res.json({ message: 'Password changed successfully. You can now sign in.' });
  } catch (err) { console.error('resetPassword error:', err); res.status(500).json({ message: 'Internal server error' }); }
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    process.env.Secret_Key,
    { expiresIn: '30d' }
  );
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function userPayload(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    coverImage: user.coverImage,
    profilePic: user.profilePic,
    artistName: user.artistName,
    bio: user.bio,
    genre: user.genre,
    instagram: user.instagram,
    twitter: user.twitter,
    website: user.website,
    isEmailVerified: user.isEmailVerified,
    isArtistVerified: user.isArtistVerified,
    artistApplication: user.artistApplication,
    followerCount: user.followers?.length || 0,
    followingCount: user.following?.length || 0,
    authMethod: user.authMethod,
  };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function usernameFromEmail(email) {
  const base = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user';
  return base + Math.floor(1000 + Math.random() * 9000);
}

// ── REQUEST EMAIL MAGIC LINK ─────────────────────────────────
// One endpoint for both "sign up" and "sign in" — if the email doesn't
// exist yet, an account is created (but only becomes real once the link
// is clicked, i.e. once the person proves they own the inbox).
async function requestEmailLink(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    let user = await usermodel.findOne({ email });

    if (!user) {
      user = await usermodel.create({
        username: usernameFromEmail(email),
        email,
        authMethod: 'email',
        isEmailVerified: false,
      });
    } else if (!['google', 'email'].includes(user.authMethod)) {
      // Self-heal accounts created under an older schema version (e.g. a
      // pre-passwordless build that stored authMethod: 'local').
      user.authMethod = 'email';
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.magicLinkTokenHash = hashToken(rawToken);
    user.magicLinkExpires   = new Date(Date.now() + MAGIC_LINK_TTL_MS);
    await user.save();

    try {
      await sendMagicLinkEmail(email, user.username, rawToken);
    } catch (emailErr) {
      // Distinguish "email service misconfigured" from a generic 500 so
      // whoever is setting this up can actually diagnose it, instead of
      // getting an opaque "Internal server error".
      console.error('Magic link email failed to send:', emailErr.message);
      return res.status(502).json({
        message: 'We couldn\'t send the sign-in email. Check MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASS (or EMAIL_USER/EMAIL_PASS) in backend .env and review server logs.',
      });
    }

    // Always the same response shape, regardless of new/existing user —
    // avoids leaking which emails are registered.
    res.json({ message: 'Check your email — we sent you a link to continue.' });
  } catch (err) {
    console.error('requestEmailLink error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── VERIFY EMAIL MAGIC LINK ───────────────────────────────────
async function verifyEmailLink(req, res) {
  try {
    const token = String(req.body.token || req.query.token || '');
    if (!token) return res.status(400).json({ message: 'Missing link token.' });

    const tokenHash = hashToken(token);
    const user = await usermodel.findOne({
      magicLinkTokenHash: tokenHash,
      magicLinkExpires: { $gt: Date.now() },
    }).select('+magicLinkTokenHash +magicLinkExpires');

    if (!user) {
      return res.status(400).json({ message: 'This link is invalid or has expired. Request a new one.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account suspended. Contact support.' });
    }

    user.isEmailVerified = true;
    user.magicLinkTokenHash = '';
    user.magicLinkExpires = undefined;
    await user.save();

    const appToken = signToken(user);
    res.cookie('token', appToken, cookieOpts());
    res.json({ message: 'Signed in!', token: appToken, user: userPayload(user) });
  } catch (err) {
    console.error('verifyEmailLink error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── GOOGLE SIGN IN ─────────────────────────────────────────
async function googleAuth(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential required' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    let user = await usermodel.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (!user.googleId) {
        user.googleId       = googleId;
        user.authMethod     = 'google';
        user.isEmailVerified = true;
        if (!user.avatar && picture) user.avatar = picture;
        await user.save();
      }
      if (!user.isActive) {
        return res.status(403).json({ message: 'Account suspended. Contact support.' });
      }
    } else {
      const base     = name?.replace(/\s+/g, '').toLowerCase() || 'user';
      const username = base + Math.floor(1000 + Math.random() * 9000);
      user = await usermodel.create({
        username,
        email,
        googleId,
        authMethod: 'google',
        avatar: picture || '',
        isEmailVerified: true,
        role: 'user',
      });
    }

    const token = signToken(user);
    res.cookie('token', token, cookieOpts());
    res.json({ message: 'Google login successful', token, user: userPayload(user) });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ message: 'Google authentication failed' });
  }
}

// ── LOGOUT ─────────────────────────────────────────────────
async function logout(req, res) {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logout successful' });
}

// ── GET ME ─────────────────────────────────────────────────
async function getMe(req, res) {
  try {
    const user = await usermodel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: userPayload(user) });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── APPLY TO BE ARTIST ─────────────────────────────────────
async function applyArtist(req, res) {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 20)
      return res.status(400).json({ message: 'Please write at least 20 characters explaining why you want to be an artist.' });

    const user = await usermodel.findById(req.user.id);
    if (user.role === 'artist')
      return res.status(400).json({ message: 'You are already an artist.' });
    if (user.artistApplication?.status === 'pending')
      return res.status(400).json({ message: 'Your application is already pending review.' });

    user.artistApplication = {
      status: 'pending',
      reason: reason.trim(),
      appliedAt: new Date(),
      reviewedAt: null,
      adminNote: '',
    };
    await user.save();

    const adminRecipients = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
    await Promise.allSettled([
      sendArtistApplicationEmail(adminRecipients, user.username, reason.trim(), user.email),
      sendArtistApplicationReceivedEmail(user.email, user.username),
    ]);

    res.json({
      message: 'Application submitted! We will review it within 48 hours.',
      artistApplication: user.artistApplication,
    });
  } catch (err) {
    console.error('applyArtist error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── UPDATE PROFILE ─────────────────────────────────────────
async function updateProfile(req, res) {
  try {
    const updates = {};
    const fields = ['username', 'bio', 'artistName', 'genre', 'website', 'instagram', 'twitter'];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (updates.username) {
      const clash = await usermodel.findOne({ username: updates.username, _id: { $ne: req.user.id } });
      if (clash) return res.status(409).json({ message: 'That username is already taken.' });
    }

    if (req.files?.avatar?.[0]) {
      const r = await uploadFile(req.files.avatar[0].buffer.toString('base64'), 'avatar-' + req.user.id);
      updates.avatar = r.url;
    }
    if (req.files?.coverImage?.[0]) {
      const r = await uploadFile(req.files.coverImage[0].buffer.toString('base64'), 'cover-' + req.user.id);
      updates.coverImage = r.url;
    }
    if (req.files?.profilePic?.[0]) {
      const r = await uploadFile(req.files.profilePic[0].buffer.toString('base64'), 'profile-' + req.user.id);
      updates.profilePic = r.url;
    }

    const user = await usermodel.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({ message: 'Profile updated', user: userPayload(user) });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── GET USER/ARTIST PROFILE (public, by id) ────────────────
// Every account has a profile — not just artists. If they're not an
// artist, songs/albums simply come back empty and the frontend shows
// a "become an artist" prompt instead of a discography.
async function getProfileById(req, res) {
  try {
    const profileUser = await usermodel.findById(req.params.userId);
    if (!profileUser) return res.status(404).json({ message: 'User not found' });

    const [songs, albums] = await Promise.all([
      musicModel.find({ artist: profileUser._id }).populate('artist', 'username artistName avatar profilePic').sort({ plays: -1 }),
      albumModel.find({ artist: profileUser._id }).populate('artist', 'username artistName avatar').sort({ createdAt: -1 }),
    ]);

    const p = userPayload(profileUser);
    p.isFollowing = req.user
      ? profileUser.followers.map(String).includes(String(req.user.id))
      : false;

    res.json({ user: p, songs, albums, totalPlays: songs.reduce((s, x) => s + (x.plays || 0), 0) });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── TOGGLE FOLLOW ─────────────────────────────────────────
async function toggleFollow(req, res) {
  try {
    const targetId = req.params.userId;
    const meId     = String(req.user.id);
    if (targetId === meId) return res.status(400).json({ message: "Can't follow yourself" });

    const target = await usermodel.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    const isFollowing = target.followers.map(String).includes(meId);
    if (isFollowing) {
      target.followers.pull(meId);
      await usermodel.findByIdAndUpdate(meId, { $pull: { following: targetId } });
    } else {
      target.followers.push(meId);
      await usermodel.findByIdAndUpdate(meId, { $addToSet: { following: targetId } });
    }
    await target.save();
    res.json({ following: !isFollowing, followerCount: target.followers.length });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── LIST FOLLOWED ARTISTS ───────────────────────────────
async function getFollowingArtists(req, res) {
  try {
    const me = await usermodel.findById(req.user.id)
      .select('following')
      .populate({
        path: 'following',
        select: 'username artistName avatar profilePic role isArtistVerified followers',
      });

    if (!me) return res.status(404).json({ message: 'User not found' });

    const artists = (me.following || []).map((u) => ({
      _id: u._id,
      username: u.username,
      artistName: u.artistName,
      avatar: u.avatar,
      profilePic: u.profilePic,
      role: u.role,
      isArtistVerified: u.isArtistVerified,
      followerCount: u.followers?.length || 0,
    }));

    res.json({ artists });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── ADMIN: list applications ───────────────────────────────
async function getApplications(req, res) {
  try {
    const apps = await usermodel.find({ 'artistApplication.status': 'pending' })
      .select('username email artistApplication createdAt');
    res.json({ applications: apps });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── ADMIN: approve/reject application ─────────────────────
async function reviewApplication(req, res) {
  try {
    const { userId, action, adminNote } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Use approve or reject.' });
    }

    const user = await usermodel.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (action === 'approve') {
      user.role = 'artist';
      user.isArtistVerified = true;
      user.artistApplication.status    = 'approved';
      user.artistApplication.reviewedAt = new Date();
      user.artistApplication.adminNote  = adminNote || '';
    } else {
      user.artistApplication.status    = 'rejected';
      user.artistApplication.reviewedAt = new Date();
      user.artistApplication.adminNote  = adminNote || '';
    }
    await user.save();

    await sendArtistApplicationReviewEmail(
      user.email,
      user.username,
      action,
      user.artistApplication.adminNote || ''
    );

    res.json({ message: `Application ${action}d`, user: userPayload(user) });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── ADMIN: get all users ──────────────────────────────────
async function getAllUsers(req, res) {
  try {
    const users = await usermodel.find().sort({ createdAt: -1 }).limit(100);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  register, resendVerification, login, forgotPassword, resetPassword,
  requestEmailLink, verifyEmailLink, googleAuth, logout, getMe,
  applyArtist, updateProfile,
  getProfileById, toggleFollow, getFollowingArtists,
  getApplications, reviewApplication, getAllUsers,
};
