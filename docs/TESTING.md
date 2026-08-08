# Purchase Order System - API and MongoDB Testing

Use a development/test MongoDB database. Do not run the smoke test against production because it creates test master data and one test PO.

## 1. Configure

Copy `.env.example` to `.env` and set at minimum:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/thetavega_po_test
JWT_SECRET=replace-with-a-long-random-secret
PORT=5000
SEED_ADMIN_USER_ID=admin
SEED_ADMIN_PASSWORD=ChangeMe@123
```

## 2. Install and seed

```bash
npm install
npm run seed
```

## 3. Database check

```bash
npm run test:db
```

This verifies:
- MongoDB ping
- all Mongoose collections
- schema indexes / unique indexes
- document counts
- Admin role and user seed
- specific PO terms
- all 28 General Terms

## 4. Core calculation tests

```bash
npm test
```

This tests syntax, FY logic, Indian amount-in-words, sample PO total (6 x 337000 = 2022000), GST, charges and invalid quantity validation.

## 5. Start API

```bash
npm run dev
```

Check manually:

- `GET http://localhost:5000/api/health`
- `GET http://localhost:5000/api/health/db`

## 6. Complete API smoke test

In a second terminal:

```bash
npm run test:api
```

The smoke test checks health, MongoDB, login, `/me`, Company, Cost Center, Project, Vendor, Delivery Address, Material, invalid PO validation, PO create/read/list, submit, approve, issue, audit and report.

To include Puppeteer PDF preview + official PDF checks:

```env
TEST_PDF=true
```

Then rerun:

```bash
npm run test:api
```

## Expected result

You should see `PASS` for every API step and the final line:

```text
[API-TEST] PASS - ... checks completed.
```

The API smoke test intentionally retains records with test names/codes so they can be inspected in MongoDB Compass after the test.
