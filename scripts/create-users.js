const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'lbstimn.db');
const userTableSql = `CREATE TABLE portal_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'counselor', 'user')),
  created_at TEXT NOT NULL
)`;
const accounts = [
  { username: 'admin', fullName: 'Admin', role: 'admin' },
  { username: 'counsellor', fullName: 'Counsellor', role: 'counselor' },
  { username: 'user', fullName: 'User', role: 'user' }
];

fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolve(this);
  }));
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function ask(prompt) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => terminal.question(prompt, answer => {
    terminal.close();
    resolve(answer.trim());
  }));
}

function askHidden(prompt) {
  const input = process.stdin;
  process.stdout.write(prompt);
  return new Promise(resolve => {
    let value = '';
    const finish = () => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      process.stdout.write('\n');
      resolve(value);
    };
    const onData = chunk => {
      const key = chunk.toString();
      if (key === '\u0003') {
        process.stdout.write('\n');
        process.exit(130);
      } else if (key === '\r' || key === '\n') {
        finish();
      } else if (key === '\u007f' || key === '\b') {
        if (value.length) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (key >= ' ' && key !== '\u001b') {
        value += key;
        process.stdout.write('*');
      }
    };
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

function derivePassword(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, hash) => error ? reject(error) : resolve(hash.toString('hex'))));
}

async function ensureUserTable() {
  const existing = await get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'portal_users'");
  if (!existing) {
    await run(userTableSql);
    return;
  }
  if (existing.sql.includes("'user'")) return;

  await run('BEGIN IMMEDIATE');
  try {
    await run(userTableSql.replace('portal_users', 'portal_users_next'));
    await run(`INSERT INTO portal_users_next (id, username, full_name, password_salt, password_hash, role, created_at)
      SELECT id, username, full_name, password_salt, password_hash, role, created_at FROM portal_users`);
    await run('DROP TABLE portal_users');
    await run('ALTER TABLE portal_users_next RENAME TO portal_users');
    await run('COMMIT');
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run npm run create-users directly in an interactive terminal so passwords stay hidden.');
  }

  await ensureUserTable();
  for (const account of accounts) {
    const existing = await get('SELECT id FROM portal_users WHERE username = ?', [account.username]);
    if (existing) {
      console.log(`Skipped ${account.username}: account already exists.`);
      continue;
    }

    const password = await askHidden(`Set password for ${account.username} (${account.role}; minimum 6 characters): `);
    const confirmation = await askHidden(`Confirm password for ${account.username}: `);
    if (password.length < 6) throw new Error(`Password for ${account.username} must be at least 6 characters.`);
    if (password !== confirmation) throw new Error(`Passwords for ${account.username} do not match.`);

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await derivePassword(password, salt);
    await run(`INSERT INTO portal_users (username, full_name, password_salt, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`, [account.username, account.fullName, salt, hash, account.role, new Date().toISOString()]);
    console.log(`Created ${account.role} account: ${account.username}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.close());
