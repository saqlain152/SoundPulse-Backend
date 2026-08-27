const express    = require('express');
const multer     = require('multer');
const music      = require('../controller/music.controller');
const { authuser, authartist } = require('../middleware/auth.middle');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB for audio uploads
});
const router = express.Router();

// PUBLIC — browsing/discovery needs no account
router.get('/all',               music.getmusic);
router.get('/getalbum',          music.getalbum);
router.get('/getalbum/:albumId', music.getalbumbyid);
router.get('/search',            music.search);

// AUTH REQUIRED — actually streaming/playing a track, and anything personal
router.post('/play/:musicId',    authuser, music.incrementPlay);
router.get('/liked',             authuser, music.getLikedSongs);
router.post('/like/:musicId',    authuser, music.likeMusic);
router.get('/recently-played',   authuser, music.getRecentlyPlayed);

// ARTIST ONLY
router.get('/my-albums', authartist, music.getMyAlbums);
router.post('/upload', authartist, upload.fields([
  { name: 'music', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]), music.Createmusic);
router.post('/album', authartist, music.createalbum);
router.post('/album/:albumId/tracks', authartist, music.addMusicToAlbum);
router.put('/album/:albumId', authartist, music.updateAlbum);
router.delete('/album/:albumId', authartist, music.deleteAlbum);
router.delete('/album/:albumId/tracks/:musicId', authartist, music.removeMusicFromAlbum);
router.delete('/:musicId', authartist, music.deleteMusic);
router.put('/:musicId', authartist, music.updateMusic);
router.post('/upload-image', authuser, upload.single('image'), music.uploadImage);

module.exports = router;
