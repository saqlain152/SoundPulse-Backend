const ImageKit = require('imagekit');

let _imagekit = null;

function getClient() {
  if (_imagekit) return _imagekit;
  if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    throw new Error('ImageKit credentials missing from .env (IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT)');
  }
  _imagekit = new ImageKit({
    publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
  return _imagekit;
}

async function uploadFile(file, originalName = 'file') {
  const ik = getClient();
  const result = await ik.upload({
    file,
    fileName: originalName.replace(/[^a-z0-9.]/gi, '_') + '_' + Date.now(),
    folder: '/melodia',
  });
  return result;
}

module.exports = { uploadFile };
