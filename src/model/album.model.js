const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  musics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Music' }],
  coverImage: { type: String, default: '' },
  genre: { type: String, default: 'Unknown' },
  description: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Album', albumSchema);
