# Ecommerco Card-Present POS (Electron + Stripe Terminal)

Production-ready baseline POS for a Dell Latitude 7400 with touch interface and Stripe Terminal-compatible card-present flows.

## Architecture

- **Frontend:** Touch-optimized HTML/CSS/JS UI (served by backend and loaded in Electron)
- **Backend:** Node.js + Express API
- **Database:** SQLite (`better-sqlite3`)
- **Payment Layer:** Stripe Terminal API with `payment_method_types: ["card_present"]`

## Folder structure

```txt
.
├── backend/
│   ├── db.js
│   └── server.js
├── electron/
│   ├── main.js
│   └── preload.js
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── package.json
└── README.md
```

## Required endpoints

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

## Stripe integration (exact pattern)

```js
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: "aed",
  payment_method_types: ["card_present"],
  capture_method: "automatic"
})
```

## POS features implemented

- Product catalog
- Cart with running total
- Pay button
- Refund button
- Receipt screen + print action
- Inventory management endpoints
- Transaction history
- NFC / EMV / manual fallback mode selection
- Card-present transaction model only

## Security and PCI controls

- No PAN/CVV card data is collected or stored locally.
- Card entry occurs on PCI-certified Stripe Terminal readers.
- Secrets are loaded from environment variables.
- `helmet` enabled.
- For production, deploy behind TLS and segmented network controls.

## Payment flow

1. Cashier selects products.
2. UI computes total.
3. Backend creates `card_present` PaymentIntent.
4. Card is tapped/inserted/keyed on terminal reader.
5. Stripe processes as card-present transaction.
6. Approval is captured and stored.
7. Receipt is shown and printable.

## Run locally

```bash
cp .env.example .env
# set STRIPE_SECRET
npm install
npm start
```

`npm start` launches:

- Backend + POS UI at `http://localhost:3001`
- Electron shell displaying the POS UI

## Notes for hardware on Dell Latitude 7400

- Attach supported Stripe Terminal EMV/NFC reader over USB/Bluetooth/LAN as configured by Stripe.
- Use `/readers` endpoint to fetch active reader IDs.
- Manual keyed fallback depends on Stripe account and reader capabilities.

## شرح سريع بالعربية (الواجهة تبقى بالإنجليزية)

هذا المشروع عبارة عن نظام نقاط بيع (POS) محلي يعمل على اللابتوب، بينما **نصوص التطبيق نفسها داخل الواجهة تبقى بالإنجليزية** حتى تكون مناسبة للتشغيل العملي للموظفين.

- الكاشير يختار المنتجات من الكتالوج.
- النظام يجمعها في السلة ويحسب الإجمالي.
- عند الدفع، السيرفر ينشئ `PaymentIntent` بنوع `card_present` فقط.
- العميل يدفع عبر Stripe Terminal (NFC/EMV أو إدخال يدوي حسب الدعم المتاح).
- بعد الموافقة، يتم حفظ العملية وإظهار شاشة الإيصال مع خيار الطباعة.

### كيف تشغّله بسرعة

```bash
cp .env.example .env
# أضف STRIPE_SECRET في ملف البيئة
npm install
npm start
```

إذا كان لديك قيود شبكة داخل بيئة العمل تمنع تنزيل الحزم من npm، ستحتاج فتح الوصول إلى الحزم المطلوبة أو تشغيل المشروع في بيئة لها صلاحية تنزيل dependencies.
