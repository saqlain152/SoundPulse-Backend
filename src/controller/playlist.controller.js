const playlistModel = require('../model/playlist.model');
const musicModel     = require('../model/music.model');

const PLAYLIST_POPULATE_TRACKS = {
  path: 'tracks',
  populate: { path: 'artist', select: 'username artistName avatar profilePic' },
};

// ── CREATE ───────────────────────────────────────────────
async function createPlaylist(req, res) {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Playlist name is required' });

    const playlist = await playlistModel.create({
      name: name.trim(),
      description: description || '',
      owner: req.user.id,
      tracks: [],
    });
    res.status(201).json({ message: 'Playlist created', playlist });
  } catch (err) {
    console.error('createPlaylist error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── LIST (mine, or a given owner's public playlists) ─────
async function listPlaylists(req, res) {
  try {
    const filter = req.query.owner ? { owner: req.query.owner } : { owner: req.user.id };
    // If viewing someone else's playlists, only return public ones
    if (req.query.owner && String(req.query.owner) !== String(req.user?.id)) {
      filter.isPublic = true;
    }
    const playlists = await playlistModel.find(filter)
      .populate('owner', 'username artistName avatar')
      .sort({ updatedAt: -1 });
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── GET ONE ────────────────────────────────────────────────
async function getPlaylist(req, res) {
  try {
    const playlist = await playlistModel.findById(req.params.id)
      .populate('owner', 'username artistName avatar')
      .populate(PLAYLIST_POPULATE_TRACKS);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    const isOwner = req.user && String(playlist.owner._id) === String(req.user.id);
    if (!playlist.isPublic && !isOwner) return res.status(403).json({ message: 'This playlist is private' });

    res.json({ playlist, isOwner, likesCount: playlist.likes.length });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── UPDATE (rename / description / cover / visibility) ────
async function updatePlaylist(req, res) {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    if (String(playlist.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only edit your own playlists' });
    }

    const { name, description, isPublic } = req.body;
    if (name !== undefined) playlist.name = name.trim();
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    await playlist.save();

    res.json({ message: 'Playlist updated', playlist });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── DELETE ────────────────────────────────────────────────
async function deletePlaylist(req, res) {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    if (String(playlist.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only delete your own playlists' });
    }
    await playlist.deleteOne();
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── ADD TRACK ─────────────────────────────────────────────
async function addTrack(req, res) {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    if (String(playlist.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only modify your own playlists' });
    }

    const { trackId } = req.body;
    const track = await musicModel.findById(trackId);
    if (!track) return res.status(404).json({ message: 'Track not found' });

    if (playlist.tracks.map(String).includes(String(trackId))) {
      return res.status(409).json({ message: 'Track already in this playlist' });
    }

    playlist.tracks.push(trackId);
    if (!playlist.coverImage && track.coverImage) playlist.coverImage = track.coverImage;
    await playlist.save();

    const populated = await playlist.populate(PLAYLIST_POPULATE_TRACKS);
    res.json({ message: 'Track added', playlist: populated });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── REMOVE TRACK ──────────────────────────────────────────
async function removeTrack(req, res) {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    if (String(playlist.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only modify your own playlists' });
    }

    playlist.tracks.pull(req.params.trackId);
    await playlist.save();

    const populated = await playlist.populate(PLAYLIST_POPULATE_TRACKS);
    res.json({ message: 'Track removed', playlist: populated });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  createPlaylist, listPlaylists, getPlaylist, updatePlaylist, deletePlaylist,
  addTrack, removeTrack,
};
