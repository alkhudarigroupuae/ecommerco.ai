const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'pos.db.json');

function nowIso() {
  return new Date().toISOString();
}

function loadState() {
  if (!fs.existsSync(dbPath)) {
    return { inventory: [], transactions: [], refunds: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return { inventory: [], transactions: [], refunds: [] };
  }
}

let state = loadState();

function persist() {
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

function seedInventoryIfNeeded() {
  if (state.inventory.length > 0) return;

  const now = nowIso();
  state.inventory = [
    { id: 'sku-espresso', name: 'Espresso', price: 1500, stock: 100, category: 'Drinks', created_at: now, updated_at: now },
    { id: 'sku-sandwich', name: 'Chicken Sandwich', price: 3200, stock: 50, category: 'Food', created_at: now, updated_at: now },
    { id: 'sku-cake', name: 'Cheesecake Slice', price: 2200, stock: 35, category: 'Dessert', created_at: now, updated_at: now },
    { id: 'sku-water', name: 'Mineral Water', price: 500, stock: 250, category: 'Drinks', created_at: now, updated_at: now }
  ];
  persist();
}

seedInventoryIfNeeded();

function getInventory() {
  return [...state.inventory].sort((a, b) => a.name.localeCompare(b.name));
}

function adjustInventory(id, stock) {
  const item = state.inventory.find((row) => row.id === id);
  if (!item) return false;
  item.stock = stock;
  item.updated_at = nowIso();
  persist();
  return true;
}

function insertTransaction(record) {
  state.transactions.push(record);
  persist();
}

function updateTransactionStatus(paymentIntentId, status) {
  let changed = 0;
  state.transactions = state.transactions.map((tx) => {
    if (tx.payment_intent_id === paymentIntentId) {
      changed += 1;
      return { ...tx, status };
    }
    return tx;
  });
  if (changed) persist();
  return changed;
}

function insertRefund(record) {
  state.refunds.push(record);
  persist();
}

function getTransactions() {
  return [...state.transactions].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function getInventoryCount() {
  return state.inventory.length;
}

module.exports = {
  getInventory,
  adjustInventory,
  insertTransaction,
  updateTransactionStatus,
  insertRefund,
  getTransactions,
  getInventoryCount
};
