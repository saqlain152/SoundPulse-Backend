const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 300 },
  coverImage:  { type: String, default: '' },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tracks:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Music' }],
  isPublic:    { type: Boolean, default: true },
  likes:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

playlistSchema.index({ name: 'text' });

module.exports = mongoose.model('Playlist', playlistSchema);
