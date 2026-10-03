const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config/env');
const db = require('../models/db');

function readRows(source, table) {
  return new Promise((resolve, reject) => source.all(`SELECT * FROM ${table}`, (error, rows) => error ? reject(error) : resolve(rows)));
}

async function main() {
  const sourcePath = process.env.SQLITE_SOURCE || config.sqlitePath;
  if (!fs.existsSync(sourcePath)) throw new Error(`SQLite source database not found: ${sourcePath}`);
  db.assertRemoteDatabaseConfiguration();

  await db.initDb();
  if (db.getDbType() === 'sqlite') throw new Error('The import target must be hosted PostgreSQL or MySQL.');
  const target = db.getClient();
  const source = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);
  const tables = ['enquiries', 'portal_users', 'remarks', 'fees'];

  try {
    for (const table of tables) {
      const result = await target.query(`SELECT COUNT(*) AS count FROM ${table}`);
      if (Number(result.rows[0]?.count) > 0) throw new Error(`Target table ${table} is not empty; import only into an empty database.`);
    }

    const definitions = {
      enquiries: ['id','name','phone','email','city','course','batch','source','status','assigned_to','follow_up_date','notes','created_at','updated_at'],
      portal_users: ['id','username','full_name','password_salt','password_hash','role','created_at'],
      remarks: ['id','enquiry_id','text','author','created_at'],
      fees: ['id','enquiry_id','amount','total_fee','payment_date','mode','notes','receipt_details','received_by','created_at'],
    };
    const defaults = { status: 'New', total_fee: 0, receipt_details: '{}', mode: 'Cash', author: 'Admin', received_by: 'Admin' };
    for (const table of tables) {
      const rows = await readRows(source, table);
      const columns = definitions[table];
      const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`;
      for (const row of rows) {
        const values = columns.map((column) => row[column] ?? defaults[column] ?? null);
        await target.query(sql, values);
      }
      console.log(`Imported ${rows.length} ${table}.`);
    }

    if (db.getDbType() === 'postgres') {
      for (const table of ['enquiries','portal_users','remarks','fees']) {
        await target.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`);
      }
    }
    console.log('SQLite data import finished. The source database was opened read-only.');
  } finally {
    await new Promise((resolve, reject) => source.close((error) => error ? reject(error) : resolve()));
    await target.close();
  }
}

main().catch((error) => {
  console.error('SQLite import failed:', error.message);
  process.exitCode = 1;
});