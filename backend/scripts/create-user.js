const crypto = require('crypto');
const db = require('../models/db');

async function main() {
  const [username, fullName, role = 'admin'] = process.argv.slice(2);
  const password = process.env.NEW_USER_PASSWORD;
  if (!username || !fullName || !password || password.length < 12 || !['admin', 'counselor', 'user'].includes(role)) {
    throw new Error('Usage: set NEW_USER_PASSWORD, then run npm run create-user -- <username> <full-name> [admin|counselor|user]. Password must have at least 12 characters.');
  }

  await db.initDb();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  await db.getClient().query(
    'INSERT INTO portal_users (username, full_name, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [username, fullName, salt, hash, role, new Date().toISOString()]
  );
  console.log(`Created ${role} account "${username}".`);
  await db.getClient().close();
}

main().catch((error) => {
  console.error('Account creation failed:', error.message);
  process.exitCode = 1;
});