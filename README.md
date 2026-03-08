# Ecommerco Card-Present POS (Local Node Runtime)

POS baseline for a Dell Latitude 7400 with touch interface and card-present oriented payment flow simulation.

## Architecture

- **Frontend:** Touch-optimized HTML/CSS/JS UI
- **Backend:** Node.js HTTP server (no external runtime deps)
- **Database:** Local JSON persistence (`backend/pos.db.json`)
- **Payment Layer:** Card-present style payment intent simulation endpoints
- **Storage:** File-based local store (works in restricted environments)

## Folder structure

```txt
.
├── backend/
│   ├── db.js
│   └── server.js
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
- No PAN/CVV data is stored in local files.
- Current implementation simulates reader interactions for local/offline development.
- For production deployment, enforce TLS, segmented network controls, and audited terminal integration.

## Payment flow

1. Cashier selects products.
2. UI computes total.
3. Backend creates `card_present` PaymentIntent.
4. Card-present action is simulated (tap/insert/manual mode in UI).
5. Server marks payment intent through process/capture states.
6. Approval state is stored locally.
7. Receipt is shown and printable.

## Run locally

```bash
npm install
npm start
```

`npm start` launches:

- Backend + POS UI at `http://localhost:3001`

## Notes for hardware on Dell Latitude 7400

- This build runs locally and can be tested without external reader SDKs.
- `/readers` returns a simulated reader for end-to-end flow validation.
- UI keeps NFC/EMV/manual payment mode selection for cashier workflow testing.

## شرح سريع بالعربية (الواجهة تبقى بالإنجليزية)

هذا المشروع عبارة عن نظام نقاط بيع (POS) محلي يعمل على اللابتوب، بينما **نصوص التطبيق نفسها داخل الواجهة تبقى بالإنجليزية** حتى تكون مناسبة للتشغيل العملي للموظفين.

- الكاشير يختار المنتجات من الكتالوج.
- النظام يجمعها في السلة ويحسب الإجمالي.
- عند الدفع، السيرفر ينشئ `PaymentIntent` بنوع `card_present` فقط.
- العميل يدفع عبر Stripe Terminal (NFC/EMV أو إدخال يدوي حسب الدعم المتاح).
- بعد الموافقة، يتم حفظ العملية وإظهار شاشة الإيصال مع خيار الطباعة.

### كيف تشغّله بسرعة

```bash
npm install
npm start
```

هذا الإصدار لا يحتاج حزم تشغيل خارجية، لذلك يعمل حتى في البيئات المقيدة بالشبكة.
