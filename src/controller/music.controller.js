const musicModel = require('../model/music.model');
const albumModel = require('../model/album.model');
const userModel  = require('../model/user.model');
const playlistModel = require('../model/playlist.model');
const { uploadFile } = require('../services/storage.services');

async function Createmusic(req, res) {
  try {
    const musicFile = req.files?.music?.[0];
    const coverFile = req.files?.cover?.[0];
    if (!musicFile) return res.status(400).json({ message: 'Please upload a music file' });
    if (!coverFile) return res.status(400).json({ message: 'Cover image is required' });

    const { title, genre } = req.body;
    if (!title) return res.status(400).json({ message: 'Music title is required' });

    const [audioResult, coverResult] = await Promise.all([
      uploadFile(musicFile.buffer.toString('base64'), musicFile.originalname),
      uploadFile(coverFile.buffer.toString('base64'), 'cover-' + Date.now()),
    ]);

    const music = await musicModel.create({
      uri:         audioResult.url,
      title,
      artist:      req.user.id,
      genre:       genre || 'Unknown',
      coverImage:  coverResult.url,
    });

    const populated = await music.populate('artist', 'username artistName avatar');
    return res.status(201).json({ message: 'Music created successfully', music: populated });
  } catch (err) {
    console.error('Createmusic error:', err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
}

async function createalbum(req, res) {
  try {
    const { title, musicId, genre, description } = req.body;
    if (!title || !musicId) return res.status(400).json({ message: 'Album title and music IDs are required' });

    const musicArray = typeof musicId === 'string'
      ? musicId.split(',').map(id => id.trim())
      : Array.isArray(musicId) ? musicId : [musicId];

    const ownedTracks = await musicModel.find({ _id: { $in: musicArray }, artist: req.user.id }).select('_id');
    if (ownedTracks.length !== musicArray.length) {
      return res.status(403).json({ message: 'Albums can only contain tracks you uploaded.' });
    }

    const album = await albumModel.create({
      title, artist: req.user.id,
      musics: musicArray,
      genre: genre || 'Unknown',
      description: description || '',
    });
    return res.status(201).json({ message: 'Album created successfully', album });
  } catch (err) {
    console.error('createalbum error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getmusic(req, res) {
  try {
    const { search, genre, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) query.title = { $regex: search, $options: 'i' };
    if (genre)  query.genre = genre;

    const musics = await musicModel.find(query)
      .populate('artist', 'username artistName avatar profilePic')
      .sort({ plays: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(200).json({ musics });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getalbum(req, res) {
  try {
    const albums = await albumModel.find()
      .populate('artist', 'username artistName avatar')
      .sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Albums fetched', album: albums });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getalbumbyid(req, res) {
  try {
    const album = await albumModel.findById(req.params.albumId)
      .populate('artist', 'username email artistName avatar profilePic')
      .populate({ path: 'musics', populate: { path: 'artist', select: 'username artistName avatar' } });
    if (!album) return res.status(404).json({ message: 'Album not found' });
    return res.status(200).json({ message: 'Album fetched', album });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getMyAlbums(req, res) {
  try {
    const albums = await albumModel.find({ artist: req.user.id })
      .populate('artist', 'username artistName avatar')
      .sort({ updatedAt: -1 });
    return res.json({ albums });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function addMusicToAlbum(req, res) {
  try {
    const album = await albumModel.findOne({ _id: req.params.albumId, artist: req.user.id });
    if (!album) return res.status(404).json({ message: 'Album not found' });
    const track = await musicModel.findOne({ _id: req.body.musicId, artist: req.user.id }).select('_id');
    if (!track) return res.status(403).json({ message: 'Albums can only contain tracks you uploaded.' });
    if (!album.musics.map(String).includes(String(req.body.musicId))) album.musics.push(req.body.musicId);
    await album.save();
    return res.json({ message: 'Track added to album', album });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateAlbum(req, res) {
  try {
    const album = await albumModel.findOne({ _id: req.params.albumId, artist: req.user.id });
    if (!album) return res.status(404).json({ message: 'Album not found' });
    if (req.body.title !== undefined) album.title = req.body.title.trim();
    if (req.body.coverImage !== undefined) album.coverImage = req.body.coverImage.trim();
    if (req.body.description !== undefined) album.description = req.body.description.trim();
    if (req.body.genre !== undefined) album.genre = req.body.genre.trim();
    await album.save();
    return res.json({ message: 'Album updated', album });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function removeMusicFromAlbum(req, res) {
  try {
    const album = await albumModel.findOne({ _id: req.params.albumId, artist: req.user.id });
    if (!album) return res.status(404).json({ message: 'Album not found' });
    album.musics = album.musics.filter(id => String(id) !== String(req.params.musicId));
    await album.save();
    return res.json({ message: 'Track removed from album', album });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateMusic(req, res) {
  try {
    const music = await musicModel.findOne({ _id: req.params.musicId, artist: req.user.id });
    if (!music) return res.status(404).json({ message: 'Track not found' });
    if (req.body.title !== undefined) {
      const title = req.body.title.trim();
      if (!title) return res.status(400).json({ message: 'Title cannot be empty' });
      music.title = title;
    }
    if (req.body.genre !== undefined) music.genre = req.body.genre.trim();
    if (req.body.coverImage !== undefined) music.coverImage = req.body.coverImage.trim();
    await music.save();
    const populated = await music.populate('artist', 'username artistName avatar');
    return res.json({ message: 'Track updated', music: populated });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function uploadImage(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No image provided' });
    const result = await uploadFile(file.buffer.toString('base64'), 'cover-' + Date.now());
    return res.json({ url: result.url });
  } catch (err) {
    console.error('uploadImage error:', err);
    return res.status(500).json({ message: 'Image upload failed' });
  }
}

async function deleteAlbum(req, res) {
  const album = await albumModel.findOne({ _id: req.params.albumId, artist: req.user.id });
  if (!album) return res.status(404).json({ message: 'Album not found' });
  await album.deleteOne();
  return res.json({ message: 'Album deleted' });
}

async function likeMusic(req, res) {
  try {
    const music = await musicModel.findById(req.params.musicId);
    if (!music) return res.status(404).json({ message: 'Music not found' });

    const userId      = req.user.id;
    const alreadyLiked = music.likes.map(String).includes(String(userId));

    if (alreadyLiked) {
      music.likes.pull(userId);
      await userModel.findByIdAndUpdate(userId, { $pull: { likedSongs: music._id } });
    } else {
      music.likes.push(userId);
      await userModel.findByIdAndUpdate(userId, { $addToSet: { likedSongs: music._id } });
    }
    await music.save();
    return res.status(200).json({ liked: !alreadyLiked, likesCount: music.likes.length });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Streaming a track requires an account — this is the moment the app
// gates on authentication (browsing/discovery stays public).
async function incrementPlay(req, res) {
  try {
    const music = await musicModel.findByIdAndUpdate(
      req.params.musicId,
      { $inc: { plays: 1 } },
      { new: true }
    );
    if (!music) return res.status(404).json({ message: 'Track not found' });

    const user = await userModel.findById(req.user.id);
    if (user) {
      user.addRecentlyPlayed(music._id);
      await user.save();
    }

    res.status(200).json({ message: 'Play counted' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getLikedSongs(req, res) {
  try {
    const user = await userModel.findById(req.user.id).populate({
      path: 'likedSongs',
      populate: { path: 'artist', select: 'username artistName avatar' },
    });
    res.status(200).json({ musics: user?.likedSongs || [] });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getRecentlyPlayed(req, res) {
  try {
    const user = await userModel.findById(req.user.id).populate({
      path: 'recentlyPlayed.track',
      populate: { path: 'artist', select: 'username artistName avatar' },
    });
    const musics = (user?.recentlyPlayed || [])
      .filter(entry => entry.track) // track may have been deleted
      .map(entry => entry.track);
    res.status(200).json({ musics });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── SEARCH — tracks, artists, and playlists in one call ────
async function search(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ tracks: [], artists: [], playlists: [] });

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [tracks, artists, playlists] = await Promise.all([
      musicModel.find({ title: regex }).limit(20)
        .populate('artist', 'username artistName avatar profilePic'),
      userModel.find({
        $or: [{ username: regex }, { artistName: regex }],
        role: { $in: ['artist', 'admin'] },
      }).limit(12).select('username artistName avatar profilePic isArtistVerified followers'),
      playlistModel.find({ name: regex, isPublic: true }).limit(12)
        .populate('owner', 'username avatar'),
    ]);

    res.json({ tracks, artists, playlists });
  } catch (err) {
    console.error('search error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  Createmusic, createalbum, getmusic, getalbum, getalbumbyid, getMyAlbums, addMusicToAlbum, updateAlbum, deleteAlbum,
  removeMusicFromAlbum, updateMusic, uploadImage,
  likeMusic, incrementPlay, getLikedSongs, getRecentlyPlayed, search,
};
