const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
  uri: { type: String, required: true },
  title: { type: String, required: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coverImage: { type: String, default: '' },
  duration: { type: Number, default: 0 }, // in seconds
  genre: { type: String, default: 'Unknown' },
  plays: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Music', musicSchema);
