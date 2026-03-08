const currency = (v) => `AED ${(v / 100).toFixed(2)}`;
const api = (path, options = {}) => fetch(path, {
  headers: { 'Content-Type': 'application/json' },
  ...options
}).then((r) => r.json());

const state = { products: [], cart: [], transactions: [], lastReceipt: null };

const catalogEl = document.getElementById('catalog');
const cartEl = document.getElementById('cart');
const totalEl = document.getElementById('total');
const historyEl = document.getElementById('history');
const receiptEl = document.getElementById('receipt');
const statusEl = document.getElementById('status');
const readerEl = document.getElementById('readerId');
const paymentEl = document.getElementById('paymentMode');

const total = () => state.cart.reduce((sum, x) => sum + (x.price * x.qty), 0);

const render = () => {
  catalogEl.innerHTML = state.products.map(p => `<button class="tile" data-id="${p.id}"><b>${p.name}</b><br>${currency(p.price)}<br><small>Stock ${p.stock}</small></button>`).join('');
  cartEl.innerHTML = state.cart.map(i => `<div class="row"><span>${i.name} x${i.qty}</span><span>${currency(i.price * i.qty)}</span></div>`).join('');
  totalEl.textContent = `Total: ${currency(total())}`;
  historyEl.innerHTML = state.transactions.map(t => `<div class="row"><span>${t.payment_intent_id.slice(-8)}</span><span>${t.status}</span><span>${currency(t.amount)}</span></div>`).join('');
  receiptEl.innerHTML = state.lastReceipt ? `
    <p>Intent: ${state.lastReceipt.id}</p>
    <p>Method: ${state.lastReceipt.mode}</p>
    <p>Status: ${state.lastReceipt.status}</p>
    <p>Total: ${currency(state.lastReceipt.total)}</p>
  ` : 'No completed transaction.';
};

catalogEl.addEventListener('click', (e) => {
  const id = e.target.closest('button')?.dataset?.id;
  if (!id) return;
  const product = state.products.find(p => p.id === id);
  const exists = state.cart.find(i => i.id === id);
  if (exists) exists.qty += 1;
  else state.cart.push({ ...product, qty: 1 });
  render();
});

document.getElementById('payBtn').addEventListener('click', async () => {
  if (!state.cart.length) return;
  statusEl.textContent = 'Creating card_present PaymentIntent...';
  const intentResp = await api('/create-payment-intent', {
    method: 'POST',
    body: JSON.stringify({ amount: total(), cart: state.cart })
  });
  if (intentResp.error) return statusEl.textContent = intentResp.error;

  if (readerEl.value) {
    statusEl.textContent = `Waiting ${paymentEl.value.toUpperCase()} on reader...`;
    await api('/process-payment-on-reader', {
      method: 'POST',
      body: JSON.stringify({ readerId: readerEl.value, paymentIntentId: intentResp.paymentIntent.id })
    });
  }

  const capResp = await api('/capture-payment', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId: intentResp.paymentIntent.id })
  });
  if (capResp.error) return statusEl.textContent = capResp.error;

  state.lastReceipt = {
    id: intentResp.paymentIntent.id,
    total: total(),
    mode: paymentEl.value,
    status: capResp.paymentIntent.status
  };
  state.cart = [];
  state.transactions = await api('/transactions');
  statusEl.textContent = `Approved: ${capResp.paymentIntent.status}`;
  render();
});

document.getElementById('refundBtn').addEventListener('click', async () => {
  if (!state.transactions.length) return;
  const latest = state.transactions[0];
  const resp = await api('/refund', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId: latest.payment_intent_id, amount: latest.amount })
  });
  statusEl.textContent = resp.error || `Refund: ${resp.refund.status}`;
  state.transactions = await api('/transactions');
  render();
});

document.getElementById('printBtn').addEventListener('click', () => window.print());

(async () => {
  state.products = await api('/inventory');
  state.transactions = await api('/transactions');
  try {
    const readers = await api('/readers');
    if (readers?.[0]?.id) readerEl.value = readers[0].id;
  } catch (_e) {}
  render();
})();
