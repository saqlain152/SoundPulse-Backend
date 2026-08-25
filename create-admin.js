/**
 * Promote an existing user to admin, or create a placeholder admin
 * account that will finish setup the first time they sign in with
 * Google or the email magic link at that same address.
 *
 *   node create-admin.js you@example.com
 *
 * (Falls back to ADMIN_EMAIL from .env if no argument is given.)
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) {
    console.error('❌ Provide an email: node create-admin.js you@example.com');
    process.exit(1);
  }

  await mongoose.connect(process.env.Mongo_Url);
  console.log('✅ Connected to MongoDB');

  const User = require('./src/model/user.model');

  let user = await User.findOne({ email });
  if (user) {
    user.role = 'admin';
    await user.save();
    console.log('✅ Existing user promoted to admin:', email);
  } else {
    const username = 'admin' + Math.floor(1000 + Math.random() * 9000);
    user = await User.create({
      username,
      email,
      authMethod: 'email',
      role: 'admin',
      isEmailVerified: false, // will verify on their first magic-link sign-in
    });
    console.log('✅ Admin placeholder created:', email);
    console.log('   They just need to sign in with Google or the email link at that address.');
  }

  process.exit(0);
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
