const mongoose = require('mongoose');

async function connectDB() {
  try {
    if (!process.env.Mongo_Url) {
      throw new Error('Mongo_Url is undefined! Check your .env file.');
    }
    await mongoose.connect(process.env.Mongo_Url);
    console.log('✅ Successfully connected to MongoDB');
  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
