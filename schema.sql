const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3001;
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'lbstimn.db');

fs.mkdirSync(dataDir, { recursive: true });

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
    receivedBy: row.received_by || 'Admin',
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
      received_by TEXT DEFAULT 'Admin',
      created_at TEXT NOT NULL,
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
    )
  `);
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'LBSTIMN backend is running' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password, email } = req.body || {};
  const userValue = username || email || 'user';
  if (!userValue || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  return res.json({
    token: 'local-demo-token',
    user: {
      name: userValue,
      role: 'counselor'
    }
  });
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

app.get('/api/fees', async (req, res) => {
  try {
    const rows = await getSql(`
      SELECT f.*, e.name as student_name
      FROM fees f
      LEFT JOIN enquiries e ON e.id = f.enquiry_id
      ORDER BY f.payment_date DESC, f.created_at DESC
    `);
    res.json(rows.map(normalizeFee));
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch fees.', error: error.message });
  }
});

app.post('/api/fees', async (req, res) => {
  try {
    const body = camelCase(req.body || {});
    const enquiryId = Number(body.enquiryId || body.enquiry_id);
    const amount = Number(body.amount || body.fee_amount || 0);
    const mode = body.mode || 'Cash';
    const notes = body.notes || '';
    const paymentDate = body.paymentDate || body.payment_date || new Date().toISOString().slice(0, 10);
    const receivedBy = body.receivedBy || body.received_by || 'Admin';

    if (!enquiryId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid enquiry and amount are required.' });
    }

    const enquiry = await getSql('SELECT * FROM enquiries WHERE id = ?', [enquiryId]);
    if (!enquiry.length) {
      return res.status(404).json({ message: 'Enquiry not found.' });
    }

    const result = await runSql(
      'INSERT INTO fees (enquiry_id, amount, payment_date, mode, notes, received_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [enquiryId, amount, paymentDate, mode, notes, receivedBy, new Date().toISOString()]
    );

    const rows = await getSql(`
      SELECT f.*, e.name as student_name
      FROM fees f
      LEFT JOIN enquiries e ON e.id = f.enquiry_id
      WHERE f.id = ?
    `, [result.id]);

    return res.status(201).json(normalizeFee(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save payment.', error: error.message });
  }
});

app.delete('/api/fees/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM fees WHERE id = ?', [Number(req.params.id)]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete payment.', error: error.message });
  }
});

app.use(express.static(__dirname));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'API endpoint not found.' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`LBSTIMN CRM backend running at http://localhost:${port}`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});