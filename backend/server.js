const http = require('http');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const db = require('./db');

const PORT = Number(process.env.PORT || 3001);
const publicDir = path.join(__dirname, '..', 'public');

const intents = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  }[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('payload_too_large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, mode: 'card_present_pos' });
  }

  if (req.method === 'GET' && url.pathname === '/inventory') {
    return sendJson(res, 200, db.getInventory());
  }

  if (req.method === 'POST' && /^\/inventory\/.+\/adjust$/.test(url.pathname)) {
    const id = decodeURIComponent(url.pathname.split('/')[2] || '');
    const body = await readBody(req).catch((e) => e);
    if (body instanceof Error) return sendJson(res, 400, { error: body.message });
    if (typeof body.stock !== 'number' || body.stock < 0) {
      return sendJson(res, 400, { error: 'stock must be a non-negative number' });
    }
    const updated = db.adjustInventory(id, body.stock);
    if (!updated) return sendJson(res, 404, { error: 'Item not found' });
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'POST' && url.pathname === '/create-payment-intent') {
    const body = await readBody(req).catch((e) => e);
    if (body instanceof Error) return sendJson(res, 400, { error: body.message });

    const { amount, currency = 'aed', cart = [], cashierId = 'cashier-1' } = body;
    if (!amount || amount < 50) {
      return sendJson(res, 400, { error: 'amount must be >= 50 (smallest currency unit)' });
    }

    const paymentIntent = {
      id: `pi_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      amount,
      currency,
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      status: 'requires_payment_method',
      metadata: {
        channel: 'pos_terminal',
        cart: JSON.stringify(cart).slice(0, 450),
        cashierId
      }
    };

    intents.set(paymentIntent.id, paymentIntent);
    db.insertTransaction({
      id: randomUUID(),
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      payment_channel: 'card_present',
      receipt_number: `RCP-${Date.now()}`,
      metadata: JSON.stringify(paymentIntent.metadata),
      created_at: new Date().toISOString()
    });

    return sendJson(res, 200, { paymentIntent });
  }

  if (req.method === 'POST' && url.pathname === '/process-payment-on-reader') {
    const body = await readBody(req).catch((e) => e);
    if (body instanceof Error) return sendJson(res, 400, { error: body.message });
    const { readerId, paymentIntentId } = body;
    if (!readerId || !paymentIntentId) {
      return sendJson(res, 400, { error: 'readerId and paymentIntentId are required' });
    }

    const intent = intents.get(paymentIntentId);
    if (!intent) return sendJson(res, 404, { error: 'payment intent not found' });

    intent.status = 'requires_capture';
    db.updateTransactionStatus(paymentIntentId, intent.status);
    return sendJson(res, 200, {
      id: `ra_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      object: 'terminal.reader_action',
      action: { status: intent.status, type: 'process_payment_intent' }
    });
  }

  if (req.method === 'POST' && url.pathname === '/capture-payment') {
    const body = await readBody(req).catch((e) => e);
    if (body instanceof Error) return sendJson(res, 400, { error: body.message });
    const { paymentIntentId } = body;
    if (!paymentIntentId) return sendJson(res, 400, { error: 'paymentIntentId is required' });

    const intent = intents.get(paymentIntentId);
    if (!intent) return sendJson(res, 404, { error: 'payment intent not found' });

    intent.status = 'succeeded';
    db.updateTransactionStatus(paymentIntentId, intent.status);
    return sendJson(res, 200, { paymentIntent: intent });
  }

  if (req.method === 'POST' && url.pathname === '/refund') {
    const body = await readBody(req).catch((e) => e);
    if (body instanceof Error) return sendJson(res, 400, { error: body.message });
    const { paymentIntentId, amount } = body;
    if (!paymentIntentId) return sendJson(res, 400, { error: 'paymentIntentId is required' });

    const intent = intents.get(paymentIntentId);
    if (!intent) return sendJson(res, 404, { error: 'payment intent not found' });

    const refund = {
      id: `re_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      payment_intent: paymentIntentId,
      amount: amount || intent.amount,
      status: 'succeeded'
    };

    db.insertRefund({
      id: randomUUID(),
      refund_id: refund.id,
      payment_intent_id: paymentIntentId,
      amount: refund.amount,
      status: refund.status,
      created_at: new Date().toISOString()
    });

    db.updateTransactionStatus(paymentIntentId, 'refunded');
    return sendJson(res, 200, { refund });
  }

  if (req.method === 'GET' && url.pathname === '/transactions') {
    return sendJson(res, 200, db.getTransactions());
  }

  if (req.method === 'GET' && url.pathname === '/readers') {
    return sendJson(res, 200, [
      { id: 'simulated_reader_001', device_type: 'simulated_wisepos_e', status: 'online', label: 'POS Reader (Simulated)' }
    ]);
  }

  if (req.method === 'POST' && url.pathname === '/connection_token') {
    return sendJson(res, 200, { secret: `pst_${randomUUID().replace(/-/g, '')}` });
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return serveFile(res, path.join(publicDir, 'index.html'));
  }

  if (req.method === 'GET') {
    return serveFile(res, path.join(publicDir, url.pathname));
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`POS backend running on http://localhost:${PORT}`);
});
