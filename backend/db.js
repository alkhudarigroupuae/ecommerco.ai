const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'pos.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_channel TEXT NOT NULL,
  receipt_number TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  refund_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

const count = db.prepare('SELECT COUNT(*) as total FROM inventory').get().total;
if (!count) {
  const now = new Date().toISOString();
  const seedStmt = db.prepare(
    `INSERT INTO inventory (id, name, price, stock, category, created_at, updated_at)
     VALUES (@id, @name, @price, @stock, @category, @created_at, @updated_at)`
  );

  const seedProducts = [
    { id: 'sku-espresso', name: 'Espresso', price: 1500, stock: 100, category: 'Drinks' },
    { id: 'sku-sandwich', name: 'Chicken Sandwich', price: 3200, stock: 50, category: 'Food' },
    { id: 'sku-cake', name: 'Cheesecake Slice', price: 2200, stock: 35, category: 'Dessert' },
    { id: 'sku-water', name: 'Mineral Water', price: 500, stock: 250, category: 'Drinks' }
  ];

  const tx = db.transaction((items) => {
    items.forEach((item) => seedStmt.run({ ...item, created_at: now, updated_at: now }));
  });
  tx(seedProducts);
}

module.exports = db;
