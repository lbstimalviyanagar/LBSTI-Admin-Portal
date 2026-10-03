const db = require('../models/db');
const { extractUserFromReq } = require('../middleware/auth');

function normalizeEnquiry(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    city: row.city || '',
    course: row.course || '',
    batch: row.batch || '',
    source: row.source || '',
    status: row.status || 'New',
    assignedTo: row.assigned_to || '',
    followUpDate: row.follow_up_date ? String(row.follow_up_date).slice(0, 10) : '',
    notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

function normalizeRemark(row) {
  if (!row) return null;
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    text: row.text || '',
    author: row.author || 'Admin',
    createdAt: row.created_at || new Date().toISOString()
  };
}

function camelCase(obj = {}) {
  const output = {};
  for (const key of Object.keys(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    output[camel] = obj[key];
  }
  return output;
}

async function getEnquiries(req, res) {
  try {
    const id = req.query.id || req.params.id;
    const resource = req.query.resource;
    const client = db.getClient();

    // Support query parameter based sub-resource: /enquiries?id=123&resource=remarks
    if (id && resource === 'remarks') {
      const remarksResult = await client.query('SELECT * FROM remarks WHERE enquiry_id = ? ORDER BY created_at ASC', [Number(id)]);
      return res.json(remarksResult.rows.map(normalizeRemark));
    }

    if (id) {
      const single = await client.query('SELECT * FROM enquiries WHERE id = ?', [Number(id)]);
      if (!single.rows || single.rows.length === 0) {
        return res.status(404).json({ message: 'Enquiry not found.' });
      }
      return res.json(normalizeEnquiry(single.rows[0]));
    }

    const result = await client.query('SELECT * FROM enquiries ORDER BY created_at DESC');
    res.json(result.rows.map(normalizeEnquiry));
  } catch (error) {
    console.error('[GET ENQUIRIES ERROR]', error);
    res.status(500).json({ message: 'Unable to fetch enquiries.' });
  }
}

async function createEnquiry(req, res) {
  try {
    const body = camelCase(req.body || {});
    const now = new Date().toISOString();
    const client = db.getClient();

    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();

    if (!name || !phone) {
      return res.status(400).json({ message: 'Student name and contact phone number are required.' });
    }

    // Check for duplicate phone number
    const existingCheck = await client.query('SELECT id, name FROM enquiries WHERE phone = ?', [phone]);
    if (existingCheck.rows && existingCheck.rows.length > 0) {
      return res.status(409).json({ message: `An enquiry for "${existingCheck.rows[0].name}" with this contact number already exists.` });
    }

    const sql = `
      INSERT INTO enquiries (
        name, phone, email, city, course, batch, source, status, assigned_to, follow_up_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const followUp = body.followUpDate ? String(body.followUpDate).slice(0, 10) : null;
    const params = [
      name,
      phone,
      body.email || '',
      body.city || '',
      body.course || '',
      body.batch || '',
      body.source || '',
      body.status || 'New',
      body.assignedTo || '',
      followUp,
      body.notes || '',
      now,
      now
    ];

    const result = await client.query(sql, params);
    const insertId = result.insertId;

    let createdRow;
    if (insertId) {
      const fetched = await client.query('SELECT * FROM enquiries WHERE id = ?', [insertId]);
      createdRow = fetched.rows[0];
    } else {
      const fetched = await client.query('SELECT * FROM enquiries WHERE name = ? AND phone = ? ORDER BY id DESC LIMIT 1', [name, phone]);
      createdRow = fetched.rows[0];
    }

    res.status(201).json(normalizeEnquiry(createdRow));
  } catch (error) {
    console.error('[CREATE ENQUIRY ERROR]', error);
    res.status(500).json({ message: 'Unable to create enquiry.' });
  }
}

async function updateEnquiry(req, res) {
  try {
    const id = Number(req.params.id || req.query.id);
    if (!id) return res.status(400).json({ message: 'Enquiry ID is required.' });

    const client = db.getClient();
    const current = await client.query('SELECT * FROM enquiries WHERE id = ?', [id]);

    if (!current.rows || current.rows.length === 0) {
      return res.status(404).json({ message: 'Enquiry not found.' });
    }

    const existing = normalizeEnquiry(current.rows[0]);
    const incoming = camelCase(req.body || {});
    const now = new Date().toISOString();

    // Check for duplicate phone on update (if phone is changed)
    if (incoming.phone && incoming.phone.trim() !== existing.phone) {
      const duplicate = await client.query('SELECT id, name FROM enquiries WHERE phone = ? AND id != ?', [incoming.phone.trim(), id]);
      if (duplicate.rows && duplicate.rows.length > 0) {
        return res.status(409).json({ message: `An enquiry for "${duplicate.rows[0].name}" with this contact number already exists.` });
      }
    }

    const updates = { ...existing, ...incoming, updatedAt: now };
    const fields = [
      'name', 'phone', 'email', 'city', 'course', 'batch', 'source', 'status', 'assignedTo', 'followUpDate', 'notes'
    ];

    const values = [];
    const setClauses = [];

    for (const key of fields) {
      const dbKey = key === 'assignedTo' ? 'assigned_to' : key === 'followUpDate' ? 'follow_up_date' : key;
      let val = updates[key] !== undefined ? updates[key] : existing[key];
      if (key === 'followUpDate' && val) {
        val = String(val).slice(0, 10);
      }
      setClauses.push(`${dbKey} = ?`);
      values.push(val === '' && key === 'followUpDate' ? null : val);
    }

    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await client.query(`UPDATE enquiries SET ${setClauses.join(', ')} WHERE id = ?`, values);
    const updated = await client.query('SELECT * FROM enquiries WHERE id = ?', [id]);
    res.json(normalizeEnquiry(updated.rows[0]));
  } catch (error) {
    console.error('[UPDATE ENQUIRY ERROR]', error);
    res.status(500).json({ message: 'Unable to update enquiry.' });
  }
}

async function deleteEnquiry(req, res) {
  try {
    const id = Number(req.params.id || req.query.id);
    if (!id) return res.status(400).json({ message: 'Enquiry ID is required.' });

    const client = db.getClient();
    await client.query('DELETE FROM remarks WHERE enquiry_id = ?', [id]);
    await client.query('DELETE FROM fees WHERE enquiry_id = ?', [id]);
    await client.query('DELETE FROM enquiries WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('[DELETE ENQUIRY ERROR]', error);
    res.status(500).json({ message: 'Unable to delete enquiry.' });
  }
}

async function confirmEnquiry(req, res) {
  try {
    const id = Number(req.params.id || req.query.id);
    if (!id) return res.status(400).json({ message: 'Enquiry ID is required.' });

    const client = db.getClient();
    const now = new Date().toISOString();
    await client.query('UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ?', ['Confirmed', now, id]);
    const updated = await client.query('SELECT * FROM enquiries WHERE id = ?', [id]);
    if (!updated.rows || updated.rows.length === 0) {
      return res.status(404).json({ message: 'Enquiry not found.' });
    }
    return res.json(normalizeEnquiry(updated.rows[0]));
  } catch (error) {
    console.error('[CONFIRM ENQUIRY ERROR]', error);
    return res.status(500).json({ message: 'Unable to confirm enquiry.' });
  }
}

async function getRemarks(req, res) {
  try {
    const id = Number(req.params.id || req.query.id);
    if (!id) return res.status(400).json({ message: 'Enquiry ID is required.' });

    const client = db.getClient();
    const rows = await client.query('SELECT * FROM remarks WHERE enquiry_id = ? ORDER BY created_at ASC', [id]);
    res.json(rows.rows.map(normalizeRemark));
  } catch (error) {
    console.error('[GET REMARKS ERROR]', error);
    res.status(500).json({ message: 'Unable to load remarks.' });
  }
}

async function addRemark(req, res) {
  try {
    const id = Number(req.params.id || req.query.id);
    if (!id) return res.status(400).json({ message: 'Enquiry ID is required.' });

    const text = String(
      (req.body && (req.body.remark || req.body.text || req.body.message || req.body.body || req.body.notes)) || ''
    ).trim();

    const user = extractUserFromReq(req);
    const author = req.body.author ? String(req.body.author) : (user && user.name) || 'Admin';

    if (!text) {
      return res.status(400).json({ message: 'Remark text is required.' });
    }

    const client = db.getClient();
    const now = new Date().toISOString();
    const result = await client.query(
      'INSERT INTO remarks (enquiry_id, text, author, created_at) VALUES (?, ?, ?, ?)',
      [id, text, author, now]
    );

    let created;
    if (result.insertId) {
      const fetched = await client.query('SELECT * FROM remarks WHERE id = ?', [result.insertId]);
      created = fetched.rows[0];
    } else {
      const fetched = await client.query('SELECT * FROM remarks WHERE enquiry_id = ? AND text = ? ORDER BY id DESC LIMIT 1', [id, text]);
      created = fetched.rows[0];
    }

    return res.status(201).json(normalizeRemark(created));
  } catch (error) {
    console.error('[ADD REMARK ERROR]', error);
    return res.status(500).json({ message: 'Unable to add remark.' });
  }
}

async function bulkCreateEnquiries(req, res) {
  try {
    const leads = req.body.leads;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: 'No leads provided for import.' });
    }

    const client = db.getClient();
    let successCount = 0;
    let skipCount = 0;

    for (const lead of leads) {
      const name = String(lead.name || '').trim();
      const phone = String(lead.phone || '').trim();

      if (!name || !phone) {
        skipCount++;
        continue;
      }

      // Check duplicate
      const existingCheck = await client.query('SELECT id FROM enquiries WHERE phone = ?', [phone]);
      if (existingCheck.rows && existingCheck.rows.length > 0) {
        skipCount++;
        continue;
      }

      const sql = `
        INSERT INTO enquiries (
          name, phone, email, city, course, batch, source, status, assigned_to, follow_up_date, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const now = new Date().toISOString();
      await client.query(sql, [
        name,
        phone,
        String(lead.email || '').trim(),
        String(lead.city || '').trim(),
        String(lead.course || '').trim(),
        String(lead.batch || '').trim(),
        String(lead.source || '').trim(),
        String(lead.status || 'New').trim(),
        String(lead.assignedTo || '').trim(),
        String(lead.followUpDate || '').trim(),
        String(lead.notes || '').trim(),
        now,
        now
      ]);

      successCount++;
    }

    res.json({ message: `Successfully imported ${successCount} leads. Skipped ${skipCount} duplicates/invalid.` });
  } catch (error) {
    console.error('[BULK IMPORT ERROR]', error);
    res.status(500).json({ message: 'Unable to process bulk import.' });
  }
}

module.exports = {
  getEnquiries,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
  confirmEnquiry,
  getRemarks,
  addRemark,
  bulkCreateEnquiries
};
