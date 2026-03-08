const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const stripeSecret = process.env.STRIPE_SECRET;
const stripe = stripeSecret ? require('stripe')(stripeSecret) : null;

const simulatedIntents = new Map();

function nowIso() {
  return new Date().toISOString();
}

function toMinor(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null;
  return Math.round(amount);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, mode: 'card_present_pos', stripe: Boolean(stripe) });
});

app.get('/inventory', (_req, res) => {
  res.json(db.getInventory());
});

app.post('/inventory/:id/adjust', (req, res) => {
  const { id } = req.params;
  const { stock } = req.body || {};

  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'stock must be a non-negative integer' });
  }

  const updated = db.adjustInventory(id, stock);
  if (!updated) return res.status(404).json({ error: 'item not found' });
  return res.json({ success: true });
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const {
      amount,
      currency = 'aed',
      paymentMode = 'nfc',
      cashierId = 'cashier-1',
      cart = []
    } = req.body || {};

    const normalizedAmount = toMinor(amount);
    if (!normalizedAmount || normalizedAmount < 50) {
      return res.status(400).json({ error: 'amount must be >= 50 in minor units' });
    }

    let paymentIntent;

    if (stripe) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: normalizedAmount,
        currency,
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        metadata: {
          channel: 'pos_terminal',
          payment_mode: paymentMode,
          cashier_id: cashierId,
          cart_snapshot: JSON.stringify(cart).slice(0, 450)
        }
      });
    } else {
      paymentIntent = {
        id: `pi_sim_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        amount: normalizedAmount,
        currency,
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        status: 'requires_payment_method'
      };
      simulatedIntents.set(paymentIntent.id, paymentIntent);
    }

    const timestamp = nowIso();
    db.insertTransaction({
      id: crypto.randomUUID(),
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      payment_channel: 'card_present',
      payment_mode: paymentMode,
      receipt_number: `RCP-${Date.now()}`,
      metadata: JSON.stringify({ cashierId, paymentMode, cart }),
      created_at: timestamp,
      updated_at: timestamp
    });

    return res.json({ paymentIntent, simulated: !stripe });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'create payment intent failed' });
  }
});

app.post('/process-payment-on-reader', async (req, res) => {
  try {
    const { readerId, paymentIntentId } = req.body || {};
    if (!readerId || !paymentIntentId) {
      return res.status(400).json({ error: 'readerId and paymentIntentId are required' });
    }

    if (stripe) {
      const action = await stripe.terminal.readers.processPaymentIntent(readerId, {
        payment_intent: paymentIntentId
      });
      db.updateTransactionStatus(paymentIntentId, action.action?.status || 'in_progress');
      return res.json(action);
    }

    const intent = simulatedIntents.get(paymentIntentId);
    if (!intent) return res.status(404).json({ error: 'payment intent not found' });
    intent.status = 'requires_capture';
    db.updateTransactionStatus(paymentIntentId, intent.status);
    return res.json({
      id: `ra_sim_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
      action: { type: 'process_payment_intent', status: intent.status }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'reader processing failed' });
  }
});

app.post('/capture-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId is required' });

    let paymentIntent;

    if (stripe) {
      paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    } else {
      paymentIntent = simulatedIntents.get(paymentIntentId);
      if (!paymentIntent) return res.status(404).json({ error: 'payment intent not found' });
      paymentIntent.status = 'succeeded';
    }

    db.updateTransactionStatus(paymentIntentId, paymentIntent.status);
    return res.json({ paymentIntent, simulated: !stripe });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'capture failed' });
  }
});

app.post('/refund', async (req, res) => {
  try {
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body || {};
    const normalizedAmount = amount ? toMinor(amount) : undefined;

    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId is required' });

    let refund;

    if (stripe) {
      refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: normalizedAmount,
        reason
      });
    } else {
      refund = {
        id: `re_sim_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        payment_intent: paymentIntentId,
        amount: normalizedAmount || 0,
        status: 'succeeded',
        reason
      };
    }

    db.insertRefund({
      id: refund.id,
      payment_intent_id: paymentIntentId,
      amount: refund.amount || 0,
      status: refund.status,
      reason,
      created_at: nowIso()
    });

    db.updateTransactionStatus(paymentIntentId, `refunded:${refund.status}`);

    return res.json({ refund, simulated: !stripe });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'refund failed' });
  }
});

app.get('/transactions', (_req, res) => {
  res.json(db.getTransactions());
});

app.post('/connection_token', async (_req, res) => {
  try {
    if (!stripe) {
      return res.json({
        secret: `pst_sim_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        simulated: true
      });
    }

    const token = await stripe.terminal.connectionTokens.create();
    return res.json(token);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'failed to create connection token' });
  }
});

app.get('/readers', async (_req, res) => {
  try {
    if (!stripe) {
      return res.json([
        {
          id: 'tmr_simulated_001',
          object: 'terminal.reader',
          label: 'Simulated Reader',
          status: 'online',
          device_type: 'simulated_wisepos_e'
        }
      ]);
    }

    const readers = await stripe.terminal.readers.list({ limit: 10 });
    return res.json(readers.data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'failed to fetch readers' });
  }
});

app.listen(PORT, () => {
  console.log(`POS backend running on http://localhost:${PORT}`);
});
