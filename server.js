const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3001;
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'lbstimn.db');
const authSecretPath = path.join(dataDir, '.auth-secret');

fs.mkdirSync(dataDir, { recursive: true });

let authSecret;
try {
  authSecret = fs.readFileSync(authSecretPath, 'utf8').trim();
} catch (error) {
  authSecret = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(authSecretPath, authSecret, { mode: 0o600, flag: 'wx' });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', dbPath);
});

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function normalizeEnquiry(row) {
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    city: row.city || '',
    course: row.course || '',
    batch: row.batch || '',
    source: row.source || '',
    status: row.status || 'New',
    assignedTo: row.assigned_to || '',
    followUpDate: row.follow_up_date || '',
    notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

function normalizeRemark(row) {
  return {
    id: row.id,
    text: row.text || '',
    author: row.author || 'Admin',
    createdAt: row.created_at || new Date().toISOString()
  };
}

function normalizeFee(row) {
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    studentName: row.student_name || row.name || '',
    amount: Number(row.amount || 0),
    paymentDate: row.payment_date || '',
    mode: row.mode || 'Cash',
    notes: row.notes || '',
    receiptDetails: (() => { try { return JSON.parse(row.receipt_details || '{}'); } catch (error) { return {}; } })(),
    receivedBy: row.received_by || 'Admin',
    totalFee: Number(row.total_fee || 0),
    phone: row.phone || '',
    course: row.course || '',
    counselor: row.assigned_to || row.received_by || '',
    createdAt: row.created_at || new Date().toISOString()
  };
}

function snakeCase(obj = {}) {
  const output = {};
  for (const key of Object.keys(obj)) {
    const snake = key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
    output[snake] = obj[key];
  }
  return output;
}

function camelCase(obj = {}) {
  const output = {};
  for (const key of Object.keys(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    output[camel] = obj[key];
  }
  return output;
}

function toDateString(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : '';
}

function withDefaults(body = {}) {
  const payload = { ...body };
  if (!payload.status) payload.status = 'New';
  if (!payload.createdAt) payload.createdAt = new Date().toISOString();
  if (!payload.updatedAt) payload.updatedAt = new Date().toISOString();
  return payload;
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT,
      course TEXT,
      batch TEXT,
      source TEXT,
      status TEXT DEFAULT 'New',
      assigned_to TEXT,
      follow_up_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      author TEXT DEFAULT 'Admin',
      created_at TEXT NOT NULL,
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT,
      mode TEXT DEFAULT 'Cash',
      notes TEXT,
      total_fee REAL NOT NULL DEFAULT 0,
      received_by TEXT DEFAULT 'Admin',
      created_at TEXT NOT NULL,
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
    )
  `);

  db.run('ALTER TABLE fees ADD COLUMN total_fee REAL NOT NULL DEFAULT 0', (err) => {
    if (err && !/duplicate column name/i.test(err.message)) console.error('Unable to add fees.total_fee:', err.message);
  });
  db.run('ALTER TABLE fees ADD COLUMN receipt_details TEXT', (err) => {
    if (err && !/duplicate column name/i.test(err.message)) console.error('Unable to add fees.receipt_details:', err.message);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS portal_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      full_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'counselor', 'user')),
      created_at TEXT NOT NULL
    )
  `);

  const defaults = [
    { username: process.env.DEFAULT_ADMIN_USERNAME || 'admin', password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', fullName: process.env.DEFAULT_ADMIN_NAME || 'Admin', role: 'admin' },
    { username: process.env.DEFAULT_COUNSELLOR_USERNAME || 'counsellor', password: process.env.DEFAULT_COUNSELLOR_PASSWORD || 'counsellor123', fullName: process.env.DEFAULT_COUNSELLOR_NAME || 'Counsellor', role: 'counselor' },
    { username: process.env.DEFAULT_USER_USERNAME || 'user', password: process.env.DEFAULT_USER_PASSWORD || 'user123', fullName: process.env.DEFAULT_USER_NAME || 'User', role: 'user' }
  ];

  db.run('DELETE FROM portal_users WHERE username IN (?, ?, ?)', ['admin', 'counsellor', 'user'], async (deleteErr) => {
    if (deleteErr) {
      console.error('Unable to clear seeded users:', deleteErr.message);
      return;
    }

    const createdAt = new Date().toISOString();
    for (const user of defaults) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(user.password, salt, 64).toString('hex');
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO portal_users (username, full_name, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [user.username, user.fullName, salt, hash, user.role, createdAt],
          (insertErr) => insertErr ? reject(insertErr) : resolve()
        );
      }).catch((insertErr) => console.error('Unable to seed default user:', insertErr.message));
    }
  });
});

const corsConfig = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const safe = /localhost|127\.0\.0\.1|github\.io|lbstimn\.com|render\.com/i.test(origin);
    callback(null, safe ? origin : '*');
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsConfig));
app.options('*', cors(corsConfig));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'LBSTIMN backend is running' });
});

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    name: user.full_name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', authSecret).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch (error) { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch (error) { return null; }
}

function requireFeesRole(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const user = match && verifyToken(match[1]);
  if (!user) return res.status(401).json({ message: 'Sign in to access fee records.' });
  if (!['admin', 'counselor', 'counsellor'].includes(user.role)) {
    return res.status(403).json({ message: 'Fees access is limited to admin and counsellor accounts.' });
  }
  req.user = user;
  next();
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password, email } = req.body || {};
  const userValue = String(username || email || '').trim();
  if (!userValue || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const users = await getSql('SELECT * FROM portal_users WHERE username = ?', [userValue]);
    const user = users[0];
    if (!user) return res.status(401).json({ message: 'Incorrect username or password.' });
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt(password, user.password_salt, 64, (error, result) => error ? reject(error) : resolve(result));
    });
    const expected = Buffer.from(user.password_hash, 'hex');
    if (hash.length !== expected.length || !crypto.timingSafeEqual(hash, expected)) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }
    return res.json({ token: signToken(user), user: { name: user.full_name, role: user.role } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to sign in.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const match = String(req.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  const user = match && verifyToken(match[1]);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  return res.json({ name: user.name, role: user.role });
});

app.get('/api/enquiries', async (req, res) => {
  try {
    const rows = await getSql('SELECT * FROM enquiries ORDER BY created_at DESC');
    res.json(rows.map(normalizeEnquiry));
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch enquiries.', error: error.message });
  }
});

app.post('/api/enquiries', async (req, res) => {
  try {
    const body = withDefaults(camelCase(req.body || {}));
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO enquiries (
        name, phone, city, course, batch, source, status, assigned_to, follow_up_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      body.name || '',
      body.phone || '',
      body.city || '',
      body.course || '',
      body.batch || '',
      body.source || '',
      body.status || 'New',
      body.assignedTo || '',
      body.followUpDate || '',
      body.notes || '',
      now,
      now
    ];

    const result = await runSql(sql, params);
    const rows = await getSql('SELECT * FROM enquiries WHERE id = ?', [result.id]);
    const created = rows[0] ? normalizeEnquiry(rows[0]) : null;
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create enquiry.', error: error.message });
  }
});

app.patch('/api/enquiries/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const incoming = camelCase(req.body || {});
    const current = await getSql('SELECT * FROM enquiries WHERE id = ?', [id]);

    if (!current.length) {
      return res.status(404).json({ message: 'Enquiry not found.' });
    }

    const existing = normalizeEnquiry(current[0]);
    const updates = { ...existing, ...incoming, updatedAt: new Date().toISOString() };
    const fields = [
      'name', 'phone', 'city', 'course', 'batch', 'source', 'status', 'assignedTo', 'followUpDate', 'notes'
    ];

    const values = [];
    const setClauses = [];

    for (const key of fields) {
      const dbKey = key === 'assignedTo' ? 'assigned_to' : key === 'followUpDate' ? 'follow_up_date' : key;
      const val = key === 'assignedTo' ? (updates.assignedTo ?? existing.assignedTo ?? '') :
                 key === 'followUpDate' ? (updates.followUpDate ?? existing.followUpDate ?? '') :
                 (updates[key] ?? existing[key] ?? '');
      setClauses.push(`${dbKey} = ?`);
      values.push(val);
    }

    setClauses.push('updated_at = ?');
    values.push(updates.updatedAt);
    values.push(id);

    await runSql(`UPDATE enquiries SET ${setClauses.join(', ')} WHERE id = ?`, values);
    const updatedRow = await getSql('SELECT * FROM enquiries WHERE id = ?', [id]);
    res.json(normalizeEnquiry(updatedRow[0]));
  } catch (error) {
    res.status(500).json({ message: 'Unable to update enquiry.', error: error.message });
  }
});

app.delete('/api/enquiries/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM remarks WHERE enquiry_id = ?', [Number(req.params.id)]);
    await runSql('DELETE FROM fees WHERE enquiry_id = ?', [Number(req.params.id)]);
    await runSql('DELETE FROM enquiries WHERE id = ?', [Number(req.params.id)]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete enquiry.', error: error.message });
  }
});

app.post('/api/enquiries/:id/confirm', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await runSql('UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ?', ['Confirmed', new Date().toISOString(), id]);
    const rows = await getSql('SELECT * FROM enquiries WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Enquiry not found.' });
    }
    return res.json(normalizeEnquiry(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Unable to confirm enquiry.', error: error.message });
  }
});

app.get('/api/enquiries/:id/remarks', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await getSql('SELECT * FROM remarks WHERE enquiry_id = ? ORDER BY created_at ASC', [id]);
    res.json(rows.map(normalizeRemark));
  } catch (error) {
    res.status(500).json({ message: 'Unable to load remarks.', error: error.message });
  }
});

app.post('/api/enquiries/:id/remarks', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const text = String((req.body && (req.body.remark || req.body.text || req.body.message || req.body.body)) || '').trim();
    const author = req.body && req.body.author ? String(req.body.author) : 'Admin';

    if (!text) {
      return res.status(400).json({ message: 'Remark text is required.' });
    }

    const result = await runSql(
      'INSERT INTO remarks (enquiry_id, text, author, created_at) VALUES (?, ?, ?, ?)',
      [id, text, author, new Date().toISOString()]
    );

    const row = await getSql('SELECT * FROM remarks WHERE id = ?', [result.id]);
    return res.status(201).json(normalizeRemark(row[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Unable to add remark.', error: error.message });
  }
});

app.get('/api/fees', requireFeesRole, async (req, res) => {
  try {
    const rows = await getSql(`
      SELECT f.*, e.name as student_name, e.phone, e.course, e.assigned_to
      FROM fees f
      LEFT JOIN enquiries e ON e.id = f.enquiry_id
      ORDER BY f.payment_date DESC, f.created_at DESC
    `);
    res.json(rows.map(normalizeFee));
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch fees.', error: error.message });
  }
});

app.post('/api/fees', requireFeesRole, async (req, res) => {
  try {
    const body = camelCase(req.body || {});
    const enquiryId = Number(body.enquiryId || body.enquiry_id);
    const amount = Number(body.amount || body.fee_amount || 0);
    const mode = body.mode || 'Cash';
    const notes = body.notes || '';
    const paymentDate = body.paymentDate || body.payment_date || new Date().toISOString().slice(0, 10);
    const receivedBy = req.user.name;
    const totalFee = Number(body.totalFee || body.total_fee || 0);
    const receiptDetails = JSON.stringify(body.receiptDetails || body.receipt_details || {});

    if (!enquiryId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid enquiry and amount are required.' });
    }

    const enquiry = await getSql('SELECT * FROM enquiries WHERE id = ?', [enquiryId]);
    if (!enquiry.length) {
      return res.status(404).json({ message: 'Enquiry not found.' });
    }

    const result = await runSql(
      'INSERT INTO fees (enquiry_id, amount, payment_date, mode, notes, total_fee, receipt_details, received_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [enquiryId, amount, paymentDate, mode, notes, totalFee, receiptDetails, receivedBy, new Date().toISOString()]
    );

    const rows = await getSql(`
      SELECT f.*, e.name as student_name, e.phone, e.course, e.assigned_to
      FROM fees f
      LEFT JOIN enquiries e ON e.id = f.enquiry_id
      WHERE f.id = ?
    `, [result.id]);

    return res.status(201).json(normalizeFee(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save payment.', error: error.message });
  }
});

app.delete('/api/fees/:id', requireFeesRole, async (req, res) => {
  try {
    await runSql('DELETE FROM fees WHERE id = ?', [Number(req.params.id)]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete payment.', error: error.message });
  }
});

app.post('/api/receipts', requireFeesRole, async (req, res) => {
  try {
    const paymentId = Number(req.body && (req.body.paymentId ?? req.body.payment_id));
    if (!paymentId) {
      return res.status(400).json({ message: 'A valid payment ID is required.' });
    }

    const rows = await getSql(`
      SELECT f.*, e.name as student_name, e.course
      FROM fees f
      LEFT JOIN enquiries e ON e.id = f.enquiry_id
      WHERE f.id = ?
    `, [paymentId]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    const receiptNumber = `LBSTI-${new Date().getFullYear()}-${String(paymentId).padStart(6, '0')}`;
    return res.json({
      receiptNumber,
      paymentId,
      studentName: rows[0].student_name || 'Student',
      amount: Number(rows[0].amount || 0),
      course: rows[0].course || '',
      issuedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to generate receipt.', error: error.message });
  }
});

app.use(express.static(__dirname));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'API endpoint not found.' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`LBSTIMN CRM backend listening on 0.0.0.0:${port}`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});