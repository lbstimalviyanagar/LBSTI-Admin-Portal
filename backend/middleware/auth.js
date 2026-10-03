const crypto = require('crypto');
const config = require('../config/env');

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    name: user.full_name,
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours expiry
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', config.authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;

  const expected = crypto.createHmac('sha256', config.authSecret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch (error) {
    return null;
  }

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.exp && claims.exp > Math.floor(Date.now() / 1000)) {
      return claims;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function extractUserFromReq(req) {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyToken(match[1]);
}

function requireAuth(req, res, next) {
  const user = extractUserFromReq(req);
  if (!user) {
    return res.status(401).json({ message: 'Authentication required. Please sign in.' });
  }
  req.user = user;
  next();
}

function requireFeesRole(req, res, next) {
  const user = extractUserFromReq(req);
  if (!user) {
    return res.status(401).json({ message: 'Sign in to access fee records.' });
  }
  const role = String(user.role || '').toLowerCase();
  if (!['admin', 'counselor', 'counsellor'].includes(role)) {
    return res.status(403).json({ message: 'Fees access is limited to admin and counsellor accounts.' });
  }
  req.user = user;
  next();
}

function requireAdminRole(req, res, next) {
  const user = extractUserFromReq(req);
  if (!user) {
    return res.status(401).json({ message: 'Sign in required.' });
  }
  const role = String(user.role || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Only administrators can perform this action.' });
  }
  req.user = user;
  next();
}

module.exports = {
  signToken,
  verifyToken,
  extractUserFromReq,
  requireAuth,
  requireFeesRole,
  requireAdminRole
};
