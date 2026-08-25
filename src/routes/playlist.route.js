const express  = require('express');
const playlist = require('../controller/playlist.controller');
const { authuser, optionalAuth } = require('../middleware/auth.middle');

const router = express.Router();

router.get('/',                     authuser, playlist.listPlaylists); // ?owner=<userId> for someone else's public ones
router.post('/',                    authuser, playlist.createPlaylist);
router.get('/:id',                  optionalAuth, playlist.getPlaylist);
router.put('/:id',                  authuser, playlist.updatePlaylist);
router.delete('/:id',               authuser, playlist.deletePlaylist);
router.post('/:id/tracks',          authuser, playlist.addTrack);
router.delete('/:id/tracks/:trackId', authuser, playlist.removeTrack);

module.exports = router;
