const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');

let dbClient = null;
let dbType = 'sqlite'; // 'postgres' | 'mysql' | 'sqlite'

const DEFAULT_EXPENSE_CATEGORIES = [
  'Stationery',
  'Pantry',
  'Marketing',
  'Google Ads',
  "Teachers' Payments",
  'Employee Salaries',
  'Office Rent',
  'Water Bills',
  'Electricity Bills',
  'Internet & Wi-Fi',
  'Maintenance',
  'Transportation',
  'Miscellaneous'
];

function assertRemoteDatabaseConfiguration() {
  const configuredUrl = config.databaseUrl || config.mysqlUrl;
  if (!configuredUrl && !config.dbHost) throw new Error('Configure a hosted PostgreSQL or MySQL database.');
  if (configuredUrl && !/^postgres(?:ql)?:\/\//i.test(configuredUrl) && !/^mysql:\/\//i.test(configuredUrl)) {
    throw new Error('DATABASE_URL must use PostgreSQL or MySQL.');
  }
  const host = (configuredUrl ? new URL(configuredUrl).hostname : config.dbHost).replace(/^\[|\]$/g, '');
  if (!host || /^(localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(host)) {
    throw new Error('Database configuration must point to a remote host, not localhost.');
  }
}

/**
 * Initializes the database connection and creates required tables.
 */
async function initDb() {
  if (config.nodeEnv === 'production') {
    if (!config.authSecret || config.authSecret.length < 32) {
      throw new Error('AUTH_SECRET must contain at least 32 characters in production.');
    }
    assertRemoteDatabaseConfiguration();
  }

  if (config.databaseUrl && (config.databaseUrl.startsWith('postgres://') || config.databaseUrl.startsWith('postgresql://'))) {
    dbType = 'postgres';
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
    });

    dbClient = {
      async query(sql, params = []) {
        // Convert ? placeholders to $1, $2, ... for PostgreSQL
        let paramIndex = 1;
        let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`).trim().replace(/;$/, '');
        if (/^INSERT\b/i.test(pgSql) && !/\bRETURNING\b/i.test(pgSql)) pgSql += ' RETURNING id';
        const res = await pool.query(pgSql, params);
        return {
          rows: res.rows,
          rowCount: res.rowCount,
          insertId: res.rows[0]?.id || null
        };
      },
      close() {
        return pool.end();
      }
    };
    console.log('[DB] Connected to PostgreSQL database');
  } else if (config.mysqlUrl || config.dbHost) {
    dbType = 'mysql';
    const mysql = require('mysql2/promise');
    const poolConfig = config.mysqlUrl ? config.mysqlUrl : {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
    const pool = mysql.createPool(poolConfig);

    dbClient = {
      async query(sql, params = []) {
        const [results] = await pool.query(sql, params);
        if (Array.isArray(results)) {
          return { rows: results, rowCount: results.length, insertId: null };
        }
        return {
          rows: [],
          rowCount: results.affectedRows,
          insertId: results.insertId
        };
      },
      close() {
        return pool.end();
      }
    };
    console.log('[DB] Connected to MySQL database');
  } else {
    dbType = 'sqlite';
    const sqlite3 = require('sqlite3').verbose();
    const dataDir = path.dirname(config.sqlitePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const sqliteDb = new sqlite3.Database(config.sqlitePath);
    dbClient = {
      query(sql, params = []) {
        return new Promise((resolve, reject) => {
          const trimmed = sql.trim().toUpperCase();
          if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN')) {
            sqliteDb.all(sql, params, (err, rows) => {
              if (err) return reject(err);
              resolve({ rows: rows || [], rowCount: rows ? rows.length : 0, insertId: null });
            });
          } else {
            sqliteDb.run(sql, params, function onRun(err) {
              if (err) return reject(err);
              resolve({ rows: [], rowCount: this.changes, insertId: this.lastID });
            });
          }
        });
      },
      close() {
        return new Promise((resolve, reject) => {
          sqliteDb.close((err) => (err ? reject(err) : resolve()));
        });
      }
    };
    console.log(`[DB] Connected to SQLite database at ${config.sqlitePath}`);
  }

  await createTablesAndSeed();
  return dbClient;
}

/**
 * Creates table schemas if they don't exist and seeds default users.
 */
async function createTablesAndSeed() {
  if (dbType === 'postgres') {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(190) NOT NULL,
        phone VARCHAR(40) NOT NULL,
        email VARCHAR(254),
        city VARCHAR(190),
        course VARCHAR(190),
        batch VARCHAR(120),
        source VARCHAR(120),
        status VARCHAR(48) DEFAULT 'New',
        assigned_to VARCHAR(190),
        follow_up_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS remarks (
        id SERIAL PRIMARY KEY,
        enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        author VARCHAR(190) DEFAULT 'Admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id SERIAL PRIMARY KEY,
        enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
        payment_date DATE,
        mode VARCHAR(40) DEFAULT 'Cash',
        notes TEXT,
        receipt_details TEXT,
        received_by VARCHAR(190) DEFAULT 'Admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS portal_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(190) NOT NULL,
        password_salt VARCHAR(64) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'counselor', 'user')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(190) NOT NULL,
        category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        expense_date DATE NOT NULL,
        payment_method VARCHAR(40) NOT NULL,
        payment_status VARCHAR(16) NOT NULL CHECK (payment_status IN ('Paid', 'Pending')),
        vendor_name VARCHAR(190) NOT NULL,
        description TEXT,
        receipt_data BYTEA,
        receipt_mime VARCHAR(80),
        receipt_name VARCHAR(255),
        created_by VARCHAR(190) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date, id)');
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id, expense_date)');
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (payment_status, expense_date)');
  } else if (dbType === 'mysql') {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(190) NOT NULL,
        phone VARCHAR(40) NOT NULL,
        email VARCHAR(254) DEFAULT NULL,
        city VARCHAR(190) DEFAULT NULL,
        course VARCHAR(190) DEFAULT NULL,
        batch VARCHAR(120) DEFAULT NULL,
        source VARCHAR(120) DEFAULT NULL,
        status VARCHAR(48) NOT NULL DEFAULT 'New',
        assigned_to VARCHAR(190) DEFAULT NULL,
        follow_up_date DATE DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS remarks (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        enquiry_id BIGINT UNSIGNED NOT NULL,
        text TEXT NOT NULL,
        author VARCHAR(190) NOT NULL DEFAULT 'Admin',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_remarks_enquiry FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        enquiry_id BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        total_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        payment_date DATE DEFAULT NULL,
        mode VARCHAR(40) NOT NULL DEFAULT 'Cash',
        notes TEXT DEFAULT NULL,
        receipt_details LONGTEXT DEFAULT NULL,
        received_by VARCHAR(190) NOT NULL DEFAULT 'Admin',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_fees_enquiry FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS portal_users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) NOT NULL,
        full_name VARCHAR(190) NOT NULL,
        password_salt VARCHAR(64) DEFAULT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'counselor', 'user') NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_portal_users_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_expense_categories_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(190) NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        expense_date DATE NOT NULL,
        payment_method VARCHAR(40) NOT NULL,
        payment_status VARCHAR(16) NOT NULL,
        vendor_name VARCHAR(190) NOT NULL,
        description TEXT DEFAULT NULL,
        receipt_data LONGBLOB DEFAULT NULL,
        receipt_mime VARCHAR(80) DEFAULT NULL,
        receipt_name VARCHAR(255) DEFAULT NULL,
        created_by VARCHAR(190) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_expenses_date (expense_date, id),
        KEY idx_expenses_category (category_id, expense_date),
        KEY idx_expenses_status (payment_status, expense_date),
        CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } else {
    // SQLite
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
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

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS remarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enquiry_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        author TEXT DEFAULT 'Admin',
        created_at TEXT NOT NULL,
        FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
      )
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enquiry_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        total_fee REAL NOT NULL DEFAULT 0,
        payment_date TEXT,
        mode TEXT DEFAULT 'Cash',
        notes TEXT,
        receipt_details TEXT,
        received_by TEXT DEFAULT 'Admin',
        created_at TEXT NOT NULL,
        FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
      )
    `);

    await dbClient.query(`
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

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        amount NUMERIC NOT NULL CHECK (amount > 0),
        expense_date TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Pending')),
        vendor_name TEXT NOT NULL,
        description TEXT,
        receipt_data BLOB,
        receipt_mime TEXT,
        receipt_name TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT
      )
    `);
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date, id)');
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id, expense_date)');
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (payment_status, expense_date)');
  }

  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    const existing = await dbClient.query(
      'SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?)',
      [name]
    );
    if (existing.rows.length === 0) {
      await dbClient.query(
        'INSERT INTO expense_categories (name, is_default) VALUES (?, ?)',
        [name, dbType === 'postgres']
      );
    }
  }

  // Seed accounts only when explicit bootstrap credentials are configured.
  await seedDefaultUsers();
}

/**
 * Seeds default administrative accounts
 */
async function seedDefaultUsers() {
  const usersToSeed = [config.defaultAdmin, config.defaultCounselor, config.defaultUser];

  for (const user of usersToSeed) {
    if (!user.username || !user.password || !user.fullName) continue;
    const existing = await dbClient.query('SELECT id, username FROM portal_users WHERE username = ?', [user.username]);
    if (existing.rows && existing.rows.length > 0) continue;

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(user.password, salt, 64).toString('hex');
    const now = new Date().toISOString();

    await dbClient.query(
      'INSERT INTO portal_users (username, full_name, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [user.username, user.fullName, salt, hash, user.role, now]
    );
    console.log(`[DB] Seeded user account: ${user.username} (${user.role})`);
  }
}

function getClient() {
  if (!dbClient) throw new Error('Database not initialized. Call initDb() first.');
  return dbClient;
}

function getDbType() {
  return dbType;
}

module.exports = {
  initDb,
  getClient,
  getDbType,
  assertRemoteDatabaseConfiguration
};
