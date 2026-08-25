const mongoose = require('mongoose');

// Melodia uses a single account type ("user"). Authentication supports
// Google Sign-In and verified email/password accounts.
// "Artist" is not a separate account type: it's a status a user unlocks by
// having their artist application approved (see artistApplication below).
const RECENTLY_PLAYED_MAX = 50;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },

  // Every account is 'user' or 'admin' (admin is an internal/operational
  // designation, never selectable at signup). 'artist' is a *capability*
  // granted after an approved application — see isArtistVerified below,
  // which is what actually gates upload access.
  role: { type: String, enum: ['user', 'artist', 'admin'], default: 'user' },

  // ── Authentication ──
  googleId:   { type: String, default: '', index: true },
  authMethod: { type: String, enum: ['google', 'email'], required: true },
  passwordHash: { type: String, default: '', select: false },

  // Single-use email verification and password-reset tokens.
  magicLinkTokenHash: { type: String, default: '', select: false },
  magicLinkExpires:   { type: Date, select: false },
  magicLinkPurpose:   { type: String, enum: ['verify', 'reset', 'signin', ''], default: '', select: false },

  // Profile
  avatar:      { type: String, default: '' },
  coverImage:  { type: String, default: '' },
  bio:         { type: String, default: '' },

  // Artist-facing display fields (usable once isArtistVerified is true)
  artistName:       { type: String, default: '' },
  profilePic:       { type: String, default: '' },
  genre:            { type: String, default: '' },
  website:          { type: String, default: '' },
  instagram:        { type: String, default: '' },
  twitter:          { type: String, default: '' },
  isArtistVerified: { type: Boolean, default: false },

  // Artist application (pending admin approval) — kept server-side only;
  // never exposed as a signup choice.
  artistApplication: {
    status:     { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    reason:     { type: String, default: '' },
    appliedAt:  { type: Date },
    reviewedAt: { type: Date },
    adminNote:  { type: String, default: '' },
  },

  // Email is inherently verified by the magic-link/Google flow (there's no
  // separate verification step anymore), but we keep the flag for display.
  isEmailVerified: { type: Boolean, default: false },

  // Social graph
  followers:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likedSongs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Music' }],
  likedPlaylists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }],

  // Recently played — capped, most-recent-first, de-duplicated on write
  recentlyPlayed: [{
    track:    { type: mongoose.Schema.Types.ObjectId, ref: 'Music' },
    playedAt: { type: Date, default: Date.now },
    _id: false,
  }],

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.index({ username: 'text', email: 'text', artistName: 'text' });

// Push a track onto recentlyPlayed: remove any existing entry for that
// track, unshift the new one, cap the list length.
userSchema.methods.addRecentlyPlayed = function (trackId) {
  this.recentlyPlayed = this.recentlyPlayed.filter(
    (entry) => String(entry.track) !== String(trackId)
  );
  this.recentlyPlayed.unshift({ track: trackId, playedAt: new Date() });
  if (this.recentlyPlayed.length > RECENTLY_PLAYED_MAX) {
    this.recentlyPlayed = this.recentlyPlayed.slice(0, RECENTLY_PLAYED_MAX);
  }
};

module.exports = mongoose.model('User', userSchema);
