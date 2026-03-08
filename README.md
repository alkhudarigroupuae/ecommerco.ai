# Ecommerco POS (Card-Present)

Production-oriented POS baseline for **Dell Latitude 7400** with touch UI and Stripe Terminal card-present flow.

## Stack

- Frontend: Electron + touch-optimized web UI (English UI)
- Backend: Node.js + Express
- Database: SQLite (via Node built-in `node:sqlite`)
- Payments: Stripe API with `payment_method_types: ["card_present"]`

## Folder structure

```txt
.
├── backend/
│   ├── db.js
│   ├── server.js
│   └── tests/
├── electron/
├── public/
├── .env.example
├── package.json
└── README.md
```

## Environment

Create `.env` from the template:

```bash
cp .env.example .env
```

Set your key:

```env
STRIPE_SECRET=sk_test_xxx
PORT=3001
```

If `STRIPE_SECRET` is missing, app runs in **simulated terminal mode** for local testing.

## API endpoints

Required:
- `POST /create-payment-intent`
- `POST /capture-payment`
- `POST /refund`
- `GET /transactions`

Also included:
- `GET /inventory`
- `POST /inventory/:id/adjust`
- `POST /connection_token`
- `GET /readers`
- `POST /process-payment-on-reader`
- `GET /health`

## Stripe PaymentIntent example

```js
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: 'aed',
  payment_method_types: ['card_present'],
  capture_method: 'automatic'
})
```

## Payment flow

1. Cashier selects products.
2. POS calculates total.
3. Backend creates a Stripe `card_present` PaymentIntent.
4. Card is tapped/inserted/read by terminal (or simulated reader).
5. Payment is processed and captured.
6. Approval status is returned.
7. Receipt is shown and printable.

## Security notes

- No PAN/CVV is collected or stored locally.
- API keys are loaded from environment variables only.
- Use HTTPS/reverse proxy and segmented PCI network for production deployment.

## Run

```bash
npm install
npm start
```

- `npm start` launches Electron POS app and starts backend process.
- For backend-only testing: `npm run start:backend`

---

## شرح بالعربي (أنا أشرح لك، والتطبيق يظل بالإنجليزي)

حبيبي هذا النظام الآن شغال كـ POS حقيقي من ناحية التدفق:
- إنشاء عملية دفع `card_present` فقط.
- دعم سيناريو القارئ الطرفي (Stripe Terminal) أو محاكاة محلية إذا ما حطيت المفتاح.
- حفظ المنتجات/العمليات/الاسترجاعات في SQLite محليًا.

يعني تقدر تختبره مباشرة على اللابتوب، وبعدها تنقله لبيئة PCI حقيقية مع قارئ Stripe Terminal فعلي.
