# API Endpoint Summary

## Authentication
- POST `/api/auth/login`
- GET `/api/auth/me`

## Masters
For each master, GET list, POST create, GET `/:id`, PUT `/:id`, PATCH `/:id/status` are available.

- `/api/companies`
- `/api/cost-centers`
- `/api/projects`
- `/api/vendors`
- `/api/materials`
- `/api/delivery-addresses`
- `/api/po-terms`
- `/api/users`
- `/api/roles`

## Purchase Orders
- GET `/api/purchase-orders`
- POST `/api/purchase-orders`
- GET `/api/purchase-orders/:id`
- PUT `/api/purchase-orders/:id`
- POST `/api/purchase-orders/:id/submit`
- POST `/api/purchase-orders/:id/approve`
- POST `/api/purchase-orders/:id/reject`
- POST `/api/purchase-orders/:id/issue`
- POST `/api/purchase-orders/:id/revise`
- POST `/api/purchase-orders/:id/cancel`
- POST `/api/purchase-orders/:id/close`
- GET `/api/purchase-orders/:id/pdf`
- POST `/api/purchase-orders/:id/pdf/regenerate`
- POST `/api/purchase-orders/:id/email`
- GET `/api/purchase-orders/:id/audit`
- POST `/api/purchase-orders/:id/attachments`
- GET `/api/purchase-orders/:id/attachments`
- GET `/api/purchase-orders/:id/attachments/:attachmentId/download`

## Reports
- GET `/api/reports/purchase-orders`
- GET `/api/reports/purchase-orders/export`
