const crypto = require('crypto');
const db = require('../models/db');

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username || '',
    fullName: row.full_name || row.fullName || '',
    role: row.role || 'user',
    createdAt: row.created_at || new Date().toISOString()
  };
}

async function getUsers(req, res) {
  try {
    const client = db.getClient();
    const result = await client.query('SELECT id, username, full_name, role, created_at FROM portal_users ORDER BY created_at DESC');
    res.json(result.rows.map(normalizeUser));
  } catch (error) {
    console.error('[GET USERS ERROR]', error);
    res.status(500).json({ message: 'Unable to fetch users.' });
  }
}

async function createUser(req, res) {
  try {
    const { username, fullName, role, password } = req.body || {};
    
    if (!username || !fullName || !role || !password) {
      return res.status(400).json({ message: 'All fields (username, full name, role, password) are required.' });
    }

    if (!['admin', 'counselor', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role provided.' });
    }

    const client = db.getClient();
    
    // Check if username already exists
    const existing = await client.query('SELECT id FROM portal_users WHERE username = ?', [username]);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(409).json({ message: 'A user with this username already exists.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const now = new Date().toISOString();

    const result = await client.query(
      'INSERT INTO portal_users (username, full_name, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [username, fullName, salt, hash, role, now]
    );

    let createdUser;
    if (result.insertId) {
      const fetched = await client.query('SELECT id, username, full_name, role, created_at FROM portal_users WHERE id = ?', [result.insertId]);
      createdUser = fetched.rows[0];
    } else {
      const fetched = await client.query('SELECT id, username, full_name, role, created_at FROM portal_users WHERE username = ?', [username]);
      createdUser = fetched.rows[0];
    }

    res.status(201).json(normalizeUser(createdUser));
  } catch (error) {
    console.error('[CREATE USER ERROR]', error);
    res.status(500).json({ message: 'Unable to create user.' });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'User ID is required.' });

    const { fullName, role, password } = req.body || {};
    const client = db.getClient();

    const current = await client.query('SELECT * FROM portal_users WHERE id = ?', [id]);
    if (!current.rows || current.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (role && !['admin', 'counselor', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role provided.' });
    }

    const updates = [];
    const values = [];

    if (fullName) {
      updates.push('full_name = ?');
      values.push(fullName);
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    if (password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      updates.push('password_salt = ?');
      values.push(salt);
      updates.push('password_hash = ?');
      values.push(hash);
    }

    if (updates.length > 0) {
      values.push(id);
      await client.query(`UPDATE portal_users SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = await client.query('SELECT id, username, full_name, role, created_at FROM portal_users WHERE id = ?', [id]);
    res.json(normalizeUser(updated.rows[0]));
  } catch (error) {
    console.error('[UPDATE USER ERROR]', error);
    res.status(500).json({ message: 'Unable to update user.' });
  }
}

async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'User ID is required.' });

    const client = db.getClient();
    await client.query('DELETE FROM portal_users WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('[DELETE USER ERROR]', error);
    res.status(500).json({ message: 'Unable to delete user.' });
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
