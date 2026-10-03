const db = require('../models/db');
const { extractUserFromReq } = require('../middleware/auth');

function normalizeFee(row) {
  if (!row) return null;
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    studentName: row.student_name || row.name || '',
    amount: Number(row.amount || 0),
    paymentDate: row.payment_date ? String(row.payment_date).slice(0, 10) : '',
    mode: row.mode || 'Cash',
    notes: row.notes || '',
    receiptDetails: (() => {
      try {
        return typeof row.receipt_details === 'string' ? JSON.parse(row.receipt_details) : (row.receipt_details || {});
      } catch (error) {
        return {};
      }
    })(),
    receivedBy: row.received_by || 'Admin',
    totalFee: Number(row.total_fee || 0),
    phone: row.phone || '',
    course: row.course || '',
    counselor: row.assigned_to || row.received_by || '',
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

async function getFees(req, res) {
  try {
    const client = db.getClient();
    const rows = await client.query(`
      SELECT f.*, e.name as student_name, e.phone, e.course, e.assigned_to
      FROM fees f
      LEFT JOIN enquiries e ON e.id = f.enquiry_id
      ORDER BY f.payment_date DESC, f.created_at DESC
    `);
    res.json(rows.rows.map(normalizeFee));
  } catch (error) {
    console.error('[GET FEES ERROR]', error);
    res.status(500).json({ message: 'Unable to fetch fees.' });
  }
}

async function createFee(req, res) {
  try {
    const body = camelCase(req.body || {});
    const enquiryId = Number(body.enquiryId || body.enquiry_id);
    const amount = Number(body.amount || body.fee_amount || 0);
    const mode = body.mode || 'Cash';
    const notes = body.notes || '';
    const paymentDate = body.paymentDate || body.payment_date || new Date().toISOString().slice(0, 10);
    const user = extractUserFromReq(req);
    const receivedBy = body.receivedBy || (user && user.name) || 'Admin';
    const totalFee = Number(body.totalFee || body.total_fee || 0);
    const receiptDetails = JSON.stringify(body.receiptDetails || body.receipt_details || {});

    if (!enquiryId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid enquiry ID and positive fee amount are required.' });
    }

    const client = db.getClient();
    const enquiry = await client.query('SELECT * FROM enquiries WHERE id = ?', [enquiryId]);
    if (!enquiry.rows || enquiry.rows.length === 0) {
      return res.status(404).json({ message: 'Selected student enquiry was not found.' });
    }

    const now = new Date().toISOString();
    const result = await client.query(
      'INSERT INTO fees (enquiry_id, amount, payment_date, mode, notes, total_fee, receipt_details, received_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [enquiryId, amount, paymentDate, mode, notes, totalFee, receiptDetails, receivedBy, now]
    );

    let created;
    if (result.insertId) {
      const rows = await client.query(`
        SELECT f.*, e.name as student_name, e.phone, e.course, e.assigned_to
        FROM fees f
        LEFT JOIN enquiries e ON e.id = f.enquiry_id
        WHERE f.id = ?
      `, [result.insertId]);
      created = rows.rows[0];
    } else {
      const rows = await client.query(`
        SELECT f.*, e.name as student_name, e.phone, e.course, e.assigned_to
        FROM fees f
        LEFT JOIN enquiries e ON e.id = f.enquiry_id
        WHERE f.enquiry_id = ? AND f.amount = ?
        ORDER BY f.id DESC LIMIT 1
      `, [enquiryId, amount]);
      created = rows.rows[0];
    }

    return res.status(201).json(normalizeFee(created));
  } catch (error) {
    console.error('[CREATE FEE ERROR]', error);
    return res.status(500).json({ message: 'Unable to save payment.' });
  }
}

async function deleteFee(req, res) {
  try {
    const id = Number(req.params.id || req.query.id);
    if (!id) return res.status(400).json({ message: 'Fee ID is required.' });

    const client = db.getClient();
    await client.query('DELETE FROM fees WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('[DELETE FEE ERROR]', error);
    res.status(500).json({ message: 'Unable to delete payment record.' });
  }
}

module.exports = {
  getFees,
  createFee,
  deleteFee
};
