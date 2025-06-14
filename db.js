// db.js
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const db = new Database('./db.sqlite');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables...
// (full schema setup here – same as what you provided)

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    app_secret_token TEXT NOT NULL,
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS account_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id),
    UNIQUE(account_id, user_id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL,
    headers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    account_id TEXT NOT NULL,
    destination_id INTEGER,
    received_data TEXT NOT NULL,
    received_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_timestamp DATETIME,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL
  )
`).run();

// Insert default roles
const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (role_name) VALUES (?)`);
insertRole.run('Admin');
insertRole.run('Normal User');

// Create indexes
db.prepare(`CREATE INDEX IF NOT EXISTS idx_accounts_secret_token ON accounts(app_secret_token)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_account_id ON logs(account_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_event_id ON logs(event_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_account_members_account_id ON account_members(account_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_destinations_account_id ON destinations(account_id)`).run();

// Timestamp helpers
const updateTimestamp = db.prepare(`UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE account_id = ?`);
const updateDestinationTimestamp = db.prepare(`UPDATE destinations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
const updateUserTimestamp = db.prepare(`UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`);

module.exports = {
  db,
  helpers: {
    updateTimestamp,
    updateDestinationTimestamp,
    updateUserTimestamp
  }
};
