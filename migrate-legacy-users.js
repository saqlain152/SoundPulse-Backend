/**
 * One-time cleanup for databases that have test data from before the
 * passwordless-auth refactor (old schema had authMethod: 'local' and a
 * `password` field that no longer exists).
 *
 *   node migrate-legacy-users.js
 *
 * Safe to run multiple times — it only touches documents that still have
 * the old shape.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.Mongo_Url);
  console.log('✅ Connected to MongoDB');

  const result = await mongoose.connection.db.collection('users').updateMany(
    { authMethod: { $nin: ['google', 'email'] } },
    { $set: { authMethod: 'email' }, $unset: { password: '' } }
  );

  console.log(`✅ Normalized ${result.modifiedCount} legacy user document(s).`);
  process.exit(0);
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
