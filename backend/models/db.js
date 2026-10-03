const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');

let dbClient = null;
let dbType = 'sqlite'; // 'postgres' | 'mysql' | 'sqlite'

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
