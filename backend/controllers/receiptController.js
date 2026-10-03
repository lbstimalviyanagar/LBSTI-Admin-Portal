const db = require('../models/db');

async function issueReceipt(req, res) {
  try {
    const paymentId = Number(req.body && (req.body.paymentId ?? req.body.payment_id));
    if (!paymentId) {
      return res.status(400).json({ message: 'A valid payment ID is required.' });
    }

    const client = db.getClient();
    const rows = await client.query(`
      SELECT f.*, e.name as student_name, e.course
      FROM fees f
      LEFT JOIN enquiries e ON e.id = f.enquiry_id
      WHERE f.id = ?
    `, [paymentId]);

    if (!rows.rows || rows.rows.length === 0) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    const payment = rows.rows[0];
    const receiptNumber = `LBSTI-${new Date().getFullYear()}-${String(paymentId).padStart(6, '0')}`;

    return res.json({
      ok: true,
      receiptNumber,
      paymentId,
      studentName: payment.student_name || 'Student',
      amount: Number(payment.amount || 0),
      course: payment.course || '',
      issuedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ISSUE RECEIPT ERROR]', error);
    return res.status(500).json({ message: 'Unable to generate receipt.' });
  }
}

module.exports = {
  issueReceipt
};
