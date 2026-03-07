require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuid } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(morgan('dev'));

const insertTransaction = db.prepare(
  `INSERT INTO transactions (id, payment_intent_id, amount, currency, status, payment_channel, receipt_number, metadata, created_at)
   VALUES (@id, @payment_intent_id, @amount, @currency, @status, @payment_channel, @receipt_number, @metadata, @created_at)`
);

const updateTransactionStatus = db.prepare(
  `UPDATE transactions SET status = @status WHERE payment_intent_id = @payment_intent_id`
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, mode: 'card_present_pos' });
});

app.get('/inventory', (_req, res) => {
  const rows = db.prepare('SELECT * FROM inventory ORDER BY name ASC').all();
  res.json(rows);
});

app.post('/inventory/:id/adjust', (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  if (typeof stock !== 'number' || stock < 0) {
    return res.status(400).json({ error: 'stock must be a non-negative number' });
  }

  const result = db.prepare('UPDATE inventory SET stock = ?, updated_at = ? WHERE id = ?').run(stock, new Date().toISOString(), id);
  if (!result.changes) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.json({ success: true });
});

app.post('/connection_token', async (_req, res) => {
  try {
    const token = await stripe.terminal.connectionTokens.create();
    res.json(token);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/readers', async (_req, res) => {
  try {
    const readers = await stripe.terminal.readers.list({ limit: 20 });
    res.json(readers.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'aed', cart = [], cashierId = 'cashier-1' } = req.body;
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'amount must be >= 50 (smallest currency unit)' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      metadata: {
        channel: 'pos_terminal',
        cart: JSON.stringify(cart).slice(0, 450),
        cashierId
      }
    });

    const now = new Date().toISOString();
    insertTransaction.run({
      id: uuid(),
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      payment_channel: 'card_present',
      receipt_number: `RCP-${Date.now()}`,
      metadata: JSON.stringify(paymentIntent.metadata),
      created_at: now
    });

    return res.json({ paymentIntent });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/capture-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }

    const intent = await stripe.paymentIntents.capture(paymentIntentId);
    updateTransactionStatus.run({ status: intent.status, payment_intent_id: paymentIntentId });

    return res.json({ paymentIntent: intent });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/process-payment-on-reader', async (req, res) => {
  try {
    const { readerId, paymentIntentId } = req.body;
    if (!readerId || !paymentIntentId) {
      return res.status(400).json({ error: 'readerId and paymentIntentId are required' });
    }

    const response = await stripe.terminal.readers.processPaymentIntent(readerId, {
      payment_intent: paymentIntentId
    });

    updateTransactionStatus.run({ status: response.action.status, payment_intent_id: paymentIntentId });
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/refund', async (req, res) => {
  try {
    const { paymentIntentId, amount } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount
    });

    db.prepare(
      `INSERT INTO refunds (id, refund_id, payment_intent_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuid(), refund.id, paymentIntentId, refund.amount, refund.status, new Date().toISOString());

    updateTransactionStatus.run({ status: 'refunded', payment_intent_id: paymentIntentId });
    return res.json({ refund });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/transactions', (_req, res) => {
  const rows = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all();
  return res.json(rows);
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`POS backend running on http://localhost:${PORT}`);
});
