const db = require('../models/db');

const PAYMENT_METHODS = new Set(['Cash', 'UPI', 'Bank Transfer', 'Card']);
const PAYMENT_STATUSES = new Set(['Paid', 'Pending']);
const RECEIPT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

function formatExpenseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value || '').slice(0, 10);
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeExpense(row) {
  return {
    id: row.id,
    expenseId: `EXP-${String(row.id).padStart(6, '0')}`,
    title: row.title,
    categoryId: row.category_id,
    categoryName: row.category_name,
    amount: Number(row.amount),
    expenseDate: formatExpenseDate(row.expense_date),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    vendorName: row.vendor_name,
    description: row.description || '',
    receiptName: row.receipt_name || '',
    receiptUrl: row.receipt_name ? `/api/expenses/${row.id}/receipt` : '',
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

async function findExpense(id) {
  const result = await db.getClient().query(`
    SELECT e.*, c.name AS category_name
    FROM expenses e
    INNER JOIN expense_categories c ON c.id = e.category_id
    WHERE e.id = ?
  `, [id]);
  return result.rows[0] || null;
}

function validateReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') {
    return { error: 'The receipt upload is invalid.' };
  }
  const mimeType = String(receipt.mimeType || '').toLowerCase();
  const data = String(receipt.data || '');
  const name = String(receipt.name || 'receipt').replace(/\\/g, '/').split('/').pop().replace(/[\u0000-\u001f\u007f"]/g, '').slice(0, 255);

  if (!RECEIPT_TYPES.has(mimeType)) {
    return { error: 'Receipts must be a PDF, JPEG, PNG, or WebP file.' };
  }
  if (!name || !data || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    return { error: 'The receipt upload is invalid.' };
  }
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_RECEIPT_BYTES) {
    return { error: 'Receipt files must be smaller than 5 MB.' };
  }

  const isValidSignature =
    (mimeType === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') ||
    (mimeType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (mimeType === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === 'image/webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP');
  if (!isValidSignature) {
    return { error: 'The receipt content does not match its file type.' };
  }

  return { data: buffer, mimeType, name };
}

function validateExpense(body) {
  const title = String(body.title || '').trim();
  const vendorName = String(body.vendorName || '').trim();
  const categoryId = validId(body.categoryId);
  const amountText = String(body.amount ?? '').trim();
  const amount = Number(amountText);
  const expenseDate = String(body.expenseDate || '');
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(expenseDate)
    ? new Date(`${expenseDate}T00:00:00.000Z`)
    : null;

  if (!title || title.length > 190) return { error: 'Expense title is required (maximum 190 characters).' };
  if (!categoryId) return { error: 'Select a valid expense category.' };
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter an amount greater than ₹0 with no more than two decimal places.' };
  }
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== expenseDate) {
    return { error: 'Enter a valid expense date.' };
  }
  if (!PAYMENT_METHODS.has(body.paymentMethod)) return { error: 'Select a valid payment method.' };
  if (!PAYMENT_STATUSES.has(body.paymentStatus)) return { error: 'Select a valid payment status.' };
  if (!vendorName || vendorName.length > 190) return { error: 'Paid To / Vendor is required (maximum 190 characters).' };

  return {
    expense: {
      title,
      categoryId,
      amount,
      expenseDate,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus,
      vendorName,
      description: String(body.description || '').trim().slice(0, 5000)
    }
  };
}

async function getExpenses(req, res) {
  try {
    const result = await db.getClient().query(`
      SELECT e.*, c.name AS category_name
      FROM expenses e
      INNER JOIN expense_categories c ON c.id = e.category_id
      ORDER BY e.expense_date DESC, e.id DESC
    `);
    res.json(result.rows.map(normalizeExpense));
  } catch (error) {
    console.error('[GET EXPENSES ERROR]', error);
    res.status(500).json({ message: 'Unable to fetch expense records.' });
  }
}

async function getCategories(req, res) {
  try {
    const result = await db.getClient().query(
      'SELECT id, name, is_default FROM expense_categories ORDER BY is_default DESC, name ASC'
    );
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      isDefault: Boolean(row.is_default)
    })));
  } catch (error) {
    console.error('[GET EXPENSE CATEGORIES ERROR]', error);
    res.status(500).json({ message: 'Unable to fetch expense categories.' });
  }
}

async function createCategory(req, res) {
  const name = String(req.body?.name || '').trim();
  if (!name || name.length > 120) {
    return res.status(400).json({ message: 'Category name is required (maximum 120 characters).' });
  }
  try {
    const client = db.getClient();
    const existing = await client.query('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?)', [name]);
    if (existing.rows.length) return res.status(409).json({ message: 'A category with this name already exists.' });
    const result = await client.query(
      'INSERT INTO expense_categories (name, is_default) VALUES (?, ?)',
      [name, false]
    );
    const id = result.insertId;
    const category = id
      ? await client.query('SELECT id, name, is_default FROM expense_categories WHERE id = ?', [id])
      : await client.query('SELECT id, name, is_default FROM expense_categories WHERE LOWER(name) = LOWER(?)', [name]);
    const row = category.rows[0];
    res.status(201).json({ id: row.id, name: row.name, isDefault: Boolean(row.is_default) });
  } catch (error) {
    console.error('[CREATE EXPENSE CATEGORY ERROR]', error);
    res.status(500).json({ message: 'Unable to create the expense category.' });
  }
}

async function updateCategory(req, res) {
  const id = validId(req.params.id);
  const name = String(req.body?.name || '').trim();
  if (!id) return res.status(400).json({ message: 'A valid category ID is required.' });
  if (!name || name.length > 120) {
    return res.status(400).json({ message: 'Category name is required (maximum 120 characters).' });
  }
  try {
    const client = db.getClient();
    const current = await client.query('SELECT id, is_default FROM expense_categories WHERE id = ?', [id]);
    if (!current.rows.length) return res.status(404).json({ message: 'Expense category not found.' });
    if (Boolean(current.rows[0].is_default)) {
      return res.status(403).json({ message: 'Predefined categories cannot be edited.' });
    }
    const duplicate = await client.query(
      'SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) AND id <> ?',
      [name, id]
    );
    if (duplicate.rows.length) return res.status(409).json({ message: 'A category with this name already exists.' });
    await client.query('UPDATE expense_categories SET name = ? WHERE id = ?', [name, id]);
    const updated = await client.query('SELECT id, name, is_default FROM expense_categories WHERE id = ?', [id]);
    const row = updated.rows[0];
    res.json({ id: row.id, name: row.name, isDefault: Boolean(row.is_default) });
  } catch (error) {
    console.error('[UPDATE EXPENSE CATEGORY ERROR]', error);
    res.status(500).json({ message: 'Unable to update the expense category.' });
  }
}

async function deleteCategory(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ message: 'A valid category ID is required.' });
  try {
    const client = db.getClient();
    const category = await client.query('SELECT id, is_default FROM expense_categories WHERE id = ?', [id]);
    if (!category.rows.length) return res.status(404).json({ message: 'Expense category not found.' });
    if (Boolean(category.rows[0].is_default)) {
      return res.status(403).json({ message: 'Predefined categories cannot be deleted.' });
    }
    const usage = await client.query('SELECT id FROM expenses WHERE category_id = ? LIMIT 1', [id]);
    if (usage.rows.length) {
      return res.status(409).json({ message: 'This category is used by existing expenses. Reassign them before deleting it.' });
    }
    await client.query('DELETE FROM expense_categories WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('[DELETE EXPENSE CATEGORY ERROR]', error);
    res.status(500).json({ message: 'Unable to delete the expense category.' });
  }
}

async function createExpense(req, res) {
  const { expense, error } = validateExpense(req.body || {});
  if (error) return res.status(400).json({ message: error });
  let receipt = null;
  if (req.body.receipt) {
    receipt = validateReceipt(req.body.receipt);
    if (receipt.error) return res.status(400).json({ message: receipt.error });
  }
  try {
    const client = db.getClient();
    const category = await client.query('SELECT id FROM expense_categories WHERE id = ?', [expense.categoryId]);
    if (!category.rows.length) return res.status(400).json({ message: 'Select an existing expense category.' });
    const result = await client.query(`
      INSERT INTO expenses
        (title, category_id, amount, expense_date, payment_method, payment_status, vendor_name, description,
         receipt_data, receipt_mime, receipt_name, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      expense.title, expense.categoryId, expense.amount, expense.expenseDate,
      expense.paymentMethod, expense.paymentStatus, expense.vendorName, expense.description,
      receipt?.data || null, receipt?.mimeType || null, receipt?.name || null,
      req.user.name || req.user.username || 'Admin'
    ]);
    const row = await findExpense(result.insertId);
    res.status(201).json(normalizeExpense(row));
  } catch (dbError) {
    console.error('[CREATE EXPENSE ERROR]', dbError);
    res.status(500).json({ message: 'Unable to save the expense.' });
  }
}

async function updateExpense(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ message: 'A valid expense ID is required.' });
  const { expense, error } = validateExpense(req.body || {});
  if (error) return res.status(400).json({ message: error });
  let receipt = null;
  if (req.body.receipt) {
    receipt = validateReceipt(req.body.receipt);
    if (receipt.error) return res.status(400).json({ message: receipt.error });
  }
  try {
    const client = db.getClient();
    const current = await client.query('SELECT id FROM expenses WHERE id = ?', [id]);
    if (!current.rows.length) return res.status(404).json({ message: 'Expense not found.' });
    const category = await client.query('SELECT id FROM expense_categories WHERE id = ?', [expense.categoryId]);
    if (!category.rows.length) return res.status(400).json({ message: 'Select an existing expense category.' });

    if (receipt) {
      await client.query(`
        UPDATE expenses
        SET title = ?, category_id = ?, amount = ?, expense_date = ?, payment_method = ?, payment_status = ?,
            vendor_name = ?, description = ?, receipt_data = ?, receipt_mime = ?, receipt_name = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        expense.title, expense.categoryId, expense.amount, expense.expenseDate,
        expense.paymentMethod, expense.paymentStatus, expense.vendorName, expense.description,
        receipt.data, receipt.mimeType, receipt.name, id
      ]);
    } else if (req.body.removeReceipt === true) {
      await client.query(`
        UPDATE expenses
        SET title = ?, category_id = ?, amount = ?, expense_date = ?, payment_method = ?, payment_status = ?,
            vendor_name = ?, description = ?, receipt_data = NULL, receipt_mime = NULL, receipt_name = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        expense.title, expense.categoryId, expense.amount, expense.expenseDate,
        expense.paymentMethod, expense.paymentStatus, expense.vendorName, expense.description, id
      ]);
    } else {
      await client.query(`
        UPDATE expenses
        SET title = ?, category_id = ?, amount = ?, expense_date = ?, payment_method = ?, payment_status = ?,
            vendor_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        expense.title, expense.categoryId, expense.amount, expense.expenseDate,
        expense.paymentMethod, expense.paymentStatus, expense.vendorName, expense.description, id
      ]);
    }
    const updated = await findExpense(id);
    res.json(normalizeExpense(updated));
  } catch (dbError) {
    console.error('[UPDATE EXPENSE ERROR]', dbError);
    res.status(500).json({ message: 'Unable to update the expense.' });
  }
}

async function deleteExpense(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ message: 'A valid expense ID is required.' });
  try {
    const result = await db.getClient().query('DELETE FROM expenses WHERE id = ?', [id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Expense not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('[DELETE EXPENSE ERROR]', error);
    res.status(500).json({ message: 'Unable to delete the expense.' });
  }
}

async function getReceipt(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ message: 'A valid expense ID is required.' });
  try {
    const result = await db.getClient().query(
      'SELECT receipt_data, receipt_mime, receipt_name FROM expenses WHERE id = ?',
      [id]
    );
    const row = result.rows[0];
    if (!row || !row.receipt_data) return res.status(404).json({ message: 'Receipt not found.' });
    const originalFilename = String(row.receipt_name || 'receipt');
    const filename = originalFilename.replace(/[^ -~]/g, '_').replace(/["\\]/g, '_');
    res.set({
      'Content-Type': row.receipt_mime,
      'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store'
    });
    res.send(Buffer.from(row.receipt_data));
  } catch (error) {
    console.error('[GET EXPENSE RECEIPT ERROR]', error);
    res.status(500).json({ message: 'Unable to fetch the receipt.' });
  }
}

module.exports = {
  getExpenses,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createExpense,
  updateExpense,
  deleteExpense,
  getReceipt
};
