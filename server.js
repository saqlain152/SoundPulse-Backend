const dotenv = require('dotenv');
dotenv.config();
const app = require('./src/app');
const connectDB = require('./src/db/db');
const { verifyMailTransport } = require('./src/services/email.service');

const PORT = process.env.PORT || 5000;

connectDB();

verifyMailTransport().catch((err) => {
  console.error('[MAIL NOT READY]', err.message);
  console.error('Magic-link requests will fail until the Gmail App Password and sender address are corrected.');
});

app.listen(PORT, () => {
  console.log(`🎵 Spotify Clone Server running on port ${PORT}`);
});
