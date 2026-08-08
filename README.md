# ThetaVega Purchase Order System - Backend v1

Backend implementation for the Purchase Order Management System defined in the supplied requirement workbook and PO PDF reference.

## Stack

- Node.js 18+
- Express.js
- MongoDB + Mongoose
- JWT authentication
- Role/permission based access
- Puppeteer HTML/CSS -> A4 PDF
- Multer attachment storage
- Nodemailer vendor dispatch

## Implemented in this v1

1. Authentication and role permissions.
2. Company Master.
3. Cost Center Master.
4. Project Master.
5. Vendor Master.
6. Material Master.
7. Delivery Address Master.
8. PO Specific / General Terms Master.
9. User and Role Master.
10. PO Draft creation and editing.
11. Server-side line, tax, packing, freight and total calculation.
12. Indian amount-in-words generation.
13. PO number sequence reservation.
14. Master-data snapshots inside PO documents.
15. Submit -> Approve/Reject -> Issue workflow.
16. Direct Draft -> Issue when approval is disabled.
17. Issued PO revision with revision number.
18. PO cancel / close.
19. Audit log.
20. File attachments.
21. A4 PDF preview and official versioned PDF generation.
22. Vendor email dispatch through SMTP.
23. PO report endpoint and CSV export.

## Important design rule

The PO stores company, vendor, delivery, cost center, project, material and T&C snapshots. Once a PO is issued, the normal update endpoint rejects modifications. A change to an issued PO must use the revision API, preserving the original revision and PDF.

## PO numbering

The supplied source defines sequential PO numbers and the `po_sequences` collection but does not define the official number-format algorithm. This backend therefore keeps the number formatter configurable:

```env
PO_NUMBER_PREFIX=10025
PO_SEQUENCE_START=1251
PO_NUMBER_PADDING=5
```

That example produces `1002501251` on a fresh financial-year sequence, matching the numeric style of the supplied PO. Before production, set the live prefix/current sequence according to the official Finance/Procurement numbering rule.

## Setup

```bash
cd po-system-backend-v1
cp .env.example .env
npm install
npm run seed
npm run dev
```

MongoDB default example:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/thetavega_po
```

API health check:

```text
GET http://localhost:5000/api/health
```

## Initial login

The seed command creates the Admin account from `.env`:

```env
SEED_ADMIN_USER_ID=admin
SEED_ADMIN_PASSWORD=ChangeMe@123
```

Change the password/environment values before deployment.

## Core API flow

### 1. Login

`POST /api/auth/login`

```json
{
  "userId": "admin",
  "password": "ChangeMe@123"
}
```

Use returned JWT as:

```text
Authorization: Bearer <token>
```

### 2. Create masters

- `POST /api/companies`
- `POST /api/cost-centers`
- `POST /api/projects`
- `POST /api/vendors`
- `POST /api/materials`
- `POST /api/delivery-addresses`

### 3. Create Draft PO

`POST /api/purchase-orders`

```json
{
  "poDate": "2026-08-07",
  "companyId": "<companyObjectId>",
  "vendorId": "<vendorObjectId>",
  "purchaseType": "Domestic",
  "poType": "Project",
  "costCenterId": "<costCenterObjectId>",
  "projectId": "<projectObjectId>",
  "deliveryAddressId": "<deliveryObjectId>",
  "header": {
    "quoteRefDocumentNo": "",
    "documentType": "Email Quote",
    "confirmedBy": "Mr. SUNIL KUMAR",
    "referenceNo": "-",
    "paymentSummary": "100 % AGAINST PI",
    "taxesDutiesText": "EXTRA AT ACTUAL"
  },
  "items": [
    {
      "materialId": "<materialObjectId>",
      "srNo": 10,
      "qty": 6,
      "rate": 337000
    }
  ],
  "charges": {
    "packingMode": "At Actual",
    "packingValue": 0,
    "freightMode": "At Actual",
    "freightValue": 0
  },
  "roundingOff": 0
}
```

The backend never trusts frontend-calculated totals. It recalculates line basic amount, GST, charges, subtotal and grand total before storage.

### 4. Workflow

```text
POST /api/purchase-orders/:id/submit
POST /api/purchase-orders/:id/approve
POST /api/purchase-orders/:id/reject
POST /api/purchase-orders/:id/issue
```

If `PO_APPROVAL_REQUIRED=false`, skip submit/approve and issue the Draft directly.

### 5. PDF

Preview any PO:

```text
GET /api/purchase-orders/:id/pdf?preview=true
```

Official Issued PO:

```text
GET /api/purchase-orders/:id/pdf?download=true
```

Regenerate a new PDF version for the same issued revision:

```text
POST /api/purchase-orders/:id/pdf/regenerate
```

### 6. Revision

```text
POST /api/purchase-orders/:id/revise
{
  "reason": "Rate revised as per vendor confirmation"
}
```

The new document keeps the same base PO number and increments `revisionNo`.

## PDF structure

The current HTML/CSS template follows the supplied PO structure:

- purchase-type heading in page header
- company legal/contact block
- PO title
- vendor and delivery blocks
- quote/project/payment reference blocks
- item table
- subtotal/rounding/total
- amount in words
- tax note
- specific Supply Terms & Conditions
- buyer/signatory block
- vendor note / END OF ORDER
- General Terms & Conditions on following pages
- company + Page X of Y footer

Puppeteer handles content continuation instead of hard-coding a 3-page limit.

## Production notes before go-live

- Replace local attachment/PDF storage with approved shared/object storage if required.
- Configure production SMTP.
- Put API behind HTTPS/reverse proxy.
- Use a strong JWT secret and production secret management.
- Back up MongoDB and generated PDFs.
- Confirm the official PO sequence format and opening number for each financial year/company.
- Confirm whether GST is included in PO grand total or represented as `EXTRA AT ACTUAL` for each business case.
- Add organization-specific approval matrix if multiple approval levels are required.

## API & MongoDB testing

A dedicated database checker and API smoke test are included. See `docs/TESTING.md`.

```bash
npm test          # syntax + core PO calculation tests
npm run test:db   # MongoDB ping, collections, indexes and seed validation
npm run test:api  # end-to-end REST API smoke test (server must be running)
```

Health endpoints:

```text
GET /api/health
GET /api/health/db
```
