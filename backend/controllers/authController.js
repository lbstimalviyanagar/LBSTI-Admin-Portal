const crypto = require('crypto');
const db = require('../models/db');
const { signToken, extractUserFromReq } = require('../middleware/auth');

function derivePassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString('hex'));
    });
  });
}

async function login(req, res) {
  try {
    const { username, password, email } = req.body || {};
    const userValue = String(username || email || '').trim();

    if (!userValue || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required.' });
    }

    const client = db.getClient();
    const result = await client.query('SELECT * FROM portal_users WHERE LOWER(username) = LOWER(?)', [userValue]);
    const user = result.rows && result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    const computedHash = await derivePassword(password, user.password_salt);
    const expectedHash = user.password_hash;

    const computedBuf = Buffer.from(computedHash, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');

    if (computedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(computedBuf, expectedBuf)) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    const token = signToken(user);
    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    return res.status(500).json({ message: 'Unable to sign in due to a server error.' });
  }
}

async function me(req, res) {
  const user = extractUserFromReq(req);
  if (!user) {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
  return res.json({
    ok: true,
    user: {
      id: user.sub,
      name: user.name,
      username: user.username,
      role: user.role
    }
  });
}

module.exports = {
  login,
  me
};
