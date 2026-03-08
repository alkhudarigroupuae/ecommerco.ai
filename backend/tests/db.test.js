const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');

test('inventory seed exists', () => {
  assert.ok(db.getInventoryCount() > 0);
});
