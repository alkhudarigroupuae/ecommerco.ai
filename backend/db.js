const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'pos.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK(price >= 0),
    stock INTEGER NOT NULL CHECK(stock >= 0),
    category TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    payment_intent_id TEXT UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    payment_channel TEXT NOT NULL,
    payment_mode TEXT NOT NULL,
    receipt_number TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    payment_intent_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
  );
`);

function nowIso() {
  return new Date().toISOString();
}

function seedInventoryIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM inventory').get().count;
  if (count > 0) return;

  const now = nowIso();
  const insert = db.prepare(`
    INSERT INTO inventory (id, name, price, stock, category, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const seed = [
    ['sku-espresso', 'Espresso', 1500, 120, 'Drinks'],
    ['sku-sandwich', 'Chicken Sandwich', 3200, 60, 'Food'],
    ['sku-cake', 'Cheesecake Slice', 2200, 40, 'Dessert'],
    ['sku-water', 'Mineral Water', 500, 300, 'Drinks']
  ];

  db.exec('BEGIN');
  try {
    for (const row of seed) {
      insert.run(row[0], row[1], row[2], row[3], row[4], now, now);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

seedInventoryIfEmpty();

function getInventory() {
  return db.prepare('SELECT * FROM inventory ORDER BY name ASC').all();
}

function adjustInventory(id, stock) {
  const result = db.prepare('UPDATE inventory SET stock = ?, updated_at = ? WHERE id = ?').run(stock, nowIso(), id);
  return result.changes > 0;
}

function insertTransaction(record) {
  db.prepare(`
    INSERT INTO transactions (
      id, payment_intent_id, amount, currency, status, payment_channel,
      payment_mode, receipt_number, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.payment_intent_id,
    record.amount,
    record.currency,
    record.status,
    record.payment_channel,
    record.payment_mode,
    record.receipt_number,
    record.metadata || null,
    record.created_at,
    record.updated_at
  );
}

function updateTransactionStatus(paymentIntentId, status) {
  const result = db.prepare('UPDATE transactions SET status = ?, updated_at = ? WHERE payment_intent_id = ?').run(status, nowIso(), paymentIntentId);
  return result.changes;
}

function getTransactions() {
  return db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all();
}

function insertRefund(refund) {
  db.prepare(`
    INSERT INTO refunds (id, payment_intent_id, amount, status, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    refund.id,
    refund.payment_intent_id,
    refund.amount,
    refund.status,
    refund.reason || null,
    refund.created_at
  );
}

function getInventoryCount() {
  return db.prepare('SELECT COUNT(*) AS count FROM inventory').get().count;
}

module.exports = {
  getInventory,
  adjustInventory,
  insertTransaction,
  updateTransactionStatus,
  getTransactions,
  insertRefund,
  getInventoryCount
};
