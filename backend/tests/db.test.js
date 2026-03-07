const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');

test('inventory seed exists', () => {
  const rows = db.prepare('SELECT COUNT(*) as total FROM inventory').get();
  assert.ok(rows.total > 0);
});
