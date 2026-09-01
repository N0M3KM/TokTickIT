# Lab 2 API Specification — TokTickIT REST API

---

## 1. General Conventions

### Base URL
```
/api
```

### Content Type
All requests and responses use `Content-Type: application/json` unless the endpoint handles file upload (`multipart/form-data`) or file download (binary stream).

### Authentication
No authentication is implemented in Lab 2. The `requesterId` is supplied by the client as a query parameter or in the request body and is used for ownership checks. This is a testing mechanism only.

### Error Response Shape
All error responses use a consistent envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description.",
    "fields": {
      "summary": "Summary is required."
    }
  }
}
```
- `code`: machine-readable string constant (snake_case, uppercase)
- `message`: human-readable summary
- `fields`: present only for validation errors; maps field names to error messages
- Stack traces are **never** included in responses

### Success Response Shape
List endpoints:
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 42,
    "totalPages": 5
  }
}
```
Single-resource endpoints return the resource object directly (not wrapped in `data`).

### HTTP Status Codes Used

| Code | Meaning |
|------|---------|
| 200 | Successful retrieval or update |
| 201 | Resource created successfully |
| 400 | Invalid input / validation failure |
| 403 | Forbidden — ownership check failed |
| 404 | Resource not found |
| 409 | Conflict — e.g. attachment count limit reached |
| 410 | Gone — soft-removed resource no longer available |
| 415 | Unsupported Media Type — disallowed file MIME type |
| 500 | Unexpected server error (safe message only) |

---

## 2. Reference Data Endpoints

### 2.1 List Active Development Requesters

```
GET /api/requesters
```

**Purpose:** Populate the Development Requester selector dropdown. Returns only active requesters.

**Query Parameters:** None

**Response — 200 OK**
```json
[
  {
    "id": 1,
    "name": "Somchai Jaidee",
    "email": "somchai.j@example.com"
  },
  {
    "id": 2,
    "name": "Nattaporn Srisuk",
    "email": "nattaporn.s@example.com"
  }
]
```
- Sorted by `name` ascending
- Inactive requesters (`isActive = false`) are excluded
- Returns an empty array `[]` if no active requesters exist (not a 404)

**Error Cases**

| Scenario | Status | Code |
|----------|--------|------|
| Unexpected server error | 500 | `INTERNAL_ERROR` |

---

### 2.2 List Active Categories

```
GET /api/categories
```

**Purpose:** Populate the Category dropdown on Create Ticket.

**Query Parameters:** None

**Response — 200 OK**
```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Network" },
  { "id": 4, "name": "Software" }
]
```
- Sorted by `name` ascending
- Only active categories returned

**Error Cases**

| Scenario | Status | Code |
|----------|--------|------|
| Unexpected server error | 500 | `INTERNAL_ERROR` |

---

### 2.3 List Active Related Systems

```
GET /api/related-systems
```

**Purpose:** Populate the Related System dropdown on Create Ticket.

**Query Parameters:** None

**Response — 200 OK**
```json
[
  { "id": 1, "name": "Campus Wi-Fi" },
  { "id": 2, "name": "Corporate Laptop" },
  { "id": 3, "name": "Email" },
  { "id": 4, "name": "Grade Submission App" },
  { "id": 5, "name": "LEB2 App" },
  { "id": 6, "name": "Printer" },
  { "id": 7, "name": "VPN" }
]
```
- Sorted by `name` ascending

**Error Cases**

| Scenario | Status | Code |
|----------|--------|------|
| Unexpected server error | 500 | `INTERNAL_ERROR` |

---

## 3. Ticket Endpoints

### 3.1 Create a Ticket

```
POST /api/tickets
```

**Purpose:** Create a new IT support ticket for the selected Development Requester.

**Request Body**
```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 3,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery drains much faster than usual even when idle. This started after last week's Windows update.",
  "requestedPriority": "MEDIUM"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `requesterId` | integer | Yes | Must reference an existing active DevRequester |
| `categoryId` | integer | Yes | Must reference an existing active Category |
| `relatedSystemId` | integer | No | If provided, must reference an existing active RelatedSystem |
| `summary` | string | Yes | 1–200 chars; trimmed; must not be blank after trimming |
| `description` | string | Yes | 1–2000 chars; trimmed; must not be blank after trimming |
| `requestedPriority` | string | Yes | One of: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |

**Response — 201 Created**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "requesterName": "Somchai Jaidee",
  "categoryId": 2,
  "categoryName": "Hardware",
  "relatedSystemId": 3,
  "relatedSystemName": "Corporate Laptop",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery drains much faster than usual even when idle. This started after last week's Windows update.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "ticketDate": "2026-08-20T09:14:00.000Z",
  "createdAt": "2026-08-20T09:14:00.000Z",
  "updatedAt": "2026-08-20T09:14:00.000Z",
  "attachments": []
}
```

**Error Cases**

| Scenario | Status | Code | `fields` |
|----------|--------|------|---------|
| `summary` is empty or blank | 400 | `VALIDATION_ERROR` | `{ "summary": "Summary is required." }` |
| `summary` exceeds 200 chars | 400 | `VALIDATION_ERROR` | `{ "summary": "Summary must not exceed 200 characters." }` |
| `description` is empty or blank | 400 | `VALIDATION_ERROR` | `{ "description": "Description is required." }` |
| `description` exceeds 2000 chars | 400 | `VALIDATION_ERROR` | `{ "description": "Description must not exceed 2000 characters." }` |
| `requestedPriority` not in enum | 400 | `VALIDATION_ERROR` | `{ "requestedPriority": "Priority must be LOW, MEDIUM, HIGH, or CRITICAL." }` |
| `categoryId` missing | 400 | `VALIDATION_ERROR` | `{ "categoryId": "Category is required." }` |
| `categoryId` does not exist | 400 | `VALIDATION_ERROR` | `{ "categoryId": "Category not found." }` |
| `requesterId` does not exist or inactive | 400 | `VALIDATION_ERROR` | `{ "requesterId": "Invalid or inactive requester." }` |
| Multiple fields invalid | 400 | `VALIDATION_ERROR` | all invalid fields in `fields` object |
| Unexpected server error | 500 | `INTERNAL_ERROR` | — |

---

### 3.2 List Requester's Tickets

```
GET /api/tickets
```

**Purpose:** Retrieve a paginated, filtered, sorted list of tickets owned by the selected Development Requester.

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `requesterId` | integer | Yes | — | Owning requester; only their tickets are returned |
| `search` | string | No | — | Case-insensitive partial match on `ticketNumber` or `summary` |
| `categoryId` | integer | No | — | Filter by category ID |
| `priority` | string | No | — | Filter by `requestedPriority` value |
| `status` | string | No | — | Filter by `currentStatus` value |
| `sort` | string | No | `createdAt` | Sort field: `ticketNumber`, `createdAt`, `updatedAt` |
| `order` | string | No | `desc` | Sort direction: `asc` or `desc` |
| `page` | integer | No | `1` | Page number (1-based); clamped to ≥ 1 |
| `pageSize` | integer | No | `10` | Items per page; permitted: `10`, `25`, `50`; invalid values clamped to `10` |

**Example Request**
```
GET /api/tickets?requesterId=1&search=laptop&categoryId=2&priority=MEDIUM&sort=createdAt&order=desc&page=1&pageSize=10
```

**Response — 200 OK**
```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TKT-2026-000042",
      "summary": "Laptop battery drains quickly",
      "categoryId": 2,
      "categoryName": "Hardware",
      "relatedSystemId": 3,
      "relatedSystemName": "Corporate Laptop",
      "requestedPriority": "MEDIUM",
      "currentStatus": "NEW",
      "ticketDate": "2026-08-20T09:14:00.000Z",
      "createdAt": "2026-08-20T09:14:00.000Z",
      "updatedAt": "2026-08-20T09:14:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  }
}
```
- Returns `data: []` with `total: 0` when no results match (not a 404)
- Does not include attachment arrays in list response (performance optimisation)

**Error Cases**

| Scenario | Status | Code |
|----------|--------|------|
| `requesterId` missing | 400 | `VALIDATION_ERROR` |
| `requesterId` is not a valid integer | 400 | `VALIDATION_ERROR` |
| Unexpected server error | 500 | `INTERNAL_ERROR` |

---

### 3.3 Get One Owned Ticket

```
GET /api/tickets/:id
```

**Purpose:** Retrieve full details of a single ticket including all attachments (active and removed). Ownership is enforced.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Ticket ID |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requesterId` | integer | Yes | Must match the ticket's owner |

**Example Request**
```
GET /api/tickets/42?requesterId=1
```

**Response — 200 OK**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "requesterName": "Somchai Jaidee",
  "categoryId": 2,
  "categoryName": "Hardware",
  "relatedSystemId": 3,
  "relatedSystemName": "Corporate Laptop",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery drains much faster than usual even when idle. This started after last week's Windows update.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "ticketDate": "2026-08-20T09:14:00.000Z",
  "createdAt": "2026-08-20T09:14:00.000Z",
  "updatedAt": "2026-08-20T09:14:00.000Z",
  "attachments": [
    {
      "id": 7,
      "originalFilename": "report.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 2411724,
      "uploadedAt": "2026-08-20T09:20:00.000Z",
      "removedAt": null,
      "removalReason": null
    },
    {
      "id": 8,
      "originalFilename": "screenshot.png",
      "mimeType": "image/png",
      "sizeBytes": 460800,
      "uploadedAt": "2026-08-20T09:21:00.000Z",
      "removedAt": "2026-08-20T10:00:00.000Z",
      "removalReason": "Uploaded wrong file"
    }
  ]
}
```
- `storageFilename` is **never** returned to the client
- Removed attachments are included with `removedAt` and `removalReason` populated
- Attachments sorted by `uploadedAt` ascending

**Error Cases**

| Scenario | Status | Code |
|----------|--------|------|
| `requesterId` missing or invalid | 400 | `VALIDATION_ERROR` |
| Ticket does not exist | 404 | `NOT_FOUND` |
| Ticket exists but belongs to a different requester | 403 | `FORBIDDEN` |
| Unexpected server error | 500 | `INTERNAL_ERROR` |

---

## 4. Attachment Endpoints

### 4.1 Upload an Attachment

```
POST /api/tickets/:id/attachments
```

**Purpose:** Upload a new attachment file to an existing ticket. Ownership enforced. Validates file type, size, and active attachment count.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Ticket ID |

**Request**
- `Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requesterId` | integer (form field) | Yes | Must match ticket owner |
| `file` | binary file | Yes | The attachment file |

**Example Request (multipart)**
```
POST /api/tickets/42/attachments
Content-Type: multipart/form-data

requesterId=1
file=<binary data>  (filename: "report.pdf", type: "application/pdf", size: 2411724 bytes)
```

**Response — 201 Created**
```json
{
  "id": 7,
  "ticketId": 42,
  "originalFilename": "report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2411724,
  "uploadedAt": "2026-08-20T09:20:00.000Z",
  "removedAt": null,
  "removalReason": null
}
```
- `storageFilename` is not returned

**Error Cases**

| Scenario | Status | Code | Detail |
|----------|--------|------|--------|
| `requesterId` missing or invalid | 400 | `VALIDATION_ERROR` | — |
| Ticket does not exist | 404 | `NOT_FOUND` | — |
| Ticket belongs to different requester | 403 | `FORBIDDEN` | — |
| No file attached | 400 | `VALIDATION_ERROR` | `"file": "A file is required."` |
| MIME type not allowed | 415 | `UNSUPPORTED_FILE_TYPE` | `"Allowed types: JPG, PNG, WEBP, PDF."` |
| File size > 5 MB (5,242,880 bytes) | 400 | `FILE_TOO_LARGE` | `"Maximum file size is 5 MB."` |
| Ticket already has 5 active attachments | 409 | `ATTACHMENT_LIMIT_REACHED` | `"Maximum of 5 active attachments per ticket."` |
| Unexpected server error | 500 | `INTERNAL_ERROR` | — |

---

### 4.2 Download an Active Attachment

```
GET /api/tickets/:id/attachments/:attachmentId/download
```

**Purpose:** Download the binary file for an active (non-removed) attachment. Returns 410 if the attachment has been soft-removed.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Ticket ID |
| `attachmentId` | integer | Attachment ID |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requesterId` | integer | Yes | Must match ticket owner |

**Response — 200 OK**
- `Content-Type`: the MIME type of the file (e.g. `application/pdf`, `image/png`)
- `Content-Disposition`: `attachment; filename="report.pdf"` (using original filename)
- Body: binary file contents

**Error Cases**

| Scenario | Status | Code |
|----------|--------|------|
| `requesterId` missing or invalid | 400 | `VALIDATION_ERROR` |
| Ticket does not exist | 404 | `NOT_FOUND` |
| Ticket belongs to different requester | 403 | `FORBIDDEN` |
| Attachment does not exist on this ticket | 404 | `NOT_FOUND` |
| Attachment has been soft-removed | 410 | `ATTACHMENT_REMOVED` |
| File missing from storage (orphaned record) | 500 | `INTERNAL_ERROR` |
| Unexpected server error | 500 | `INTERNAL_ERROR` |

---

### 4.3 Soft-Remove an Attachment

```
DELETE /api/tickets/:id/attachments/:attachmentId
```

**Purpose:** Soft-remove an active attachment. Sets `removedAt` and `removalReason`; does not delete the database record or the stored file. The file becomes non-downloadable.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Ticket ID |
| `attachmentId` | integer | Attachment ID |

**Request Body**
```json
{
  "requesterId": 1,
  "removalReason": "Uploaded wrong file version."
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `requesterId` | integer | Yes | Must match ticket owner |
| `removalReason` | string | Yes | 1–500 chars; trimmed; must not be blank |

**Response — 200 OK**
```json
{
  "id": 7,
  "ticketId": 42,
  "originalFilename": "report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2411724,
  "uploadedAt": "2026-08-20T09:20:00.000Z",
  "removedAt": "2026-08-20T10:00:00.000Z",
  "removalReason": "Uploaded wrong file version."
}
```

**Error Cases**

| Scenario | Status | Code | Detail |
|----------|--------|------|--------|
| `requesterId` missing or invalid | 400 | `VALIDATION_ERROR` | — |
| `removalReason` missing or blank | 400 | `VALIDATION_ERROR` | `"removalReason": "Removal reason is required."` |
| `removalReason` exceeds 500 chars | 400 | `VALIDATION_ERROR` | `"removalReason": "Removal reason must not exceed 500 characters."` |
| Ticket does not exist | 404 | `NOT_FOUND` | — |
| Ticket belongs to different requester | 403 | `FORBIDDEN` | — |
| Attachment does not exist on this ticket | 404 | `NOT_FOUND` | — |
| Attachment already soft-removed | 409 | `ALREADY_REMOVED` | `"This attachment has already been removed."` |
| Only owner may remove (extra guard) | 403 | `FORBIDDEN` | — |
| Unexpected server error | 500 | `INTERNAL_ERROR` | — |

---

## 5. Error Code Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | One or more input fields failed validation. See `fields` map. |
| `NOT_FOUND` | 404 | The requested resource does not exist. |
| `FORBIDDEN` | 403 | The requester does not own this resource. |
| `ATTACHMENT_LIMIT_REACHED` | 409 | Ticket already has 5 active attachments. |
| `ALREADY_REMOVED` | 409 | Attachment has already been soft-removed. |
| `UNSUPPORTED_FILE_TYPE` | 415 | Uploaded file type is not allowed. |
| `FILE_TOO_LARGE` | 400 | Uploaded file exceeds the 5 MB size limit. |
| `ATTACHMENT_REMOVED` | 410 | The requested attachment has been soft-removed and is not available. |
| `INTERNAL_ERROR` | 500 | An unexpected server error occurred. No internal details are exposed. |

---

## 6. Endpoint Summary Table

| Method | Path | Purpose | Success Status |
|--------|------|---------|---------------|
| GET | `/api/requesters` | List active Dev Requesters | 200 |
| GET | `/api/categories` | List active Categories | 200 |
| GET | `/api/related-systems` | List active Related Systems | 200 |
| POST | `/api/tickets` | Create a Ticket | 201 |
| GET | `/api/tickets` | List Requester's Tickets (paginated) | 200 |
| GET | `/api/tickets/:id` | Get one owned Ticket with attachments | 200 |
| POST | `/api/tickets/:id/attachments` | Upload Attachment | 201 |
| GET | `/api/tickets/:id/attachments/:attachmentId/download` | Download active Attachment | 200 |
| DELETE | `/api/tickets/:id/attachments/:attachmentId` | Soft-remove Attachment | 200 |

---

## 7. Ownership Enforcement Rules

The following ownership checks must be applied server-side for every applicable endpoint. Client-supplied `requesterId` is the current testing substitute for an authenticated session.

| Endpoint | Check |
|----------|-------|
| `GET /api/tickets` | Only returns tickets where `ticket.requesterId = requesterId` param |
| `GET /api/tickets/:id` | Returns 403 if `ticket.requesterId ≠ requesterId` query param |
| `POST /api/tickets/:id/attachments` | Returns 403 if `ticket.requesterId ≠ requesterId` form field |
| `GET /api/tickets/:id/attachments/:attachmentId/download` | Returns 403 if `ticket.requesterId ≠ requesterId` query param |
| `DELETE /api/tickets/:id/attachments/:attachmentId` | Returns 403 if `ticket.requesterId ≠ requesterId` body field |

Note: The attachment must belong to the ticket specified in the path (`:id`). If the attachment exists but belongs to a different ticket, return 404.

---

## 8. Pagination Design Details

### Request
- `page`: 1-based integer. Values < 1 are clamped to 1.
- `pageSize`: must be 10, 25, or 50. Any other value is clamped to 10.

### Response Metadata
```json
"pagination": {
  "page": 2,
  "pageSize": 10,
  "total": 42,
  "totalPages": 5
}
```
- `total`: total number of matching records (before pagination)
- `totalPages`: `Math.ceil(total / pageSize)`
- If `page` exceeds `totalPages`, return an empty `data: []` with correct pagination metadata (not a 404)

---

## 9. Ticket List Query — Detailed Behaviour

| Parameter | Behaviour |
|-----------|-----------|
| `search` | Case-insensitive `ILIKE %value%` on both `ticketNumber` and `summary`; both fields ORed |
| `categoryId` | Exact match on `ticket.categoryId` |
| `priority` | Exact match on `ticket.requestedPriority` enum value |
| `status` | Exact match on `ticket.currentStatus` enum value |
| `sort=ticketNumber` | Sort by `ticketNumber` string (lexicographic); secondary sort: `createdAt desc` |
| `sort=createdAt` | Sort by `createdAt` timestamp; secondary sort: `id desc` |
| `sort=updatedAt` | Sort by `updatedAt` timestamp; secondary sort: `id desc` |
| Unknown `sort` value | Fallback to default `createdAt desc` |
| Unknown `order` value | Fallback to `desc` |
| Multiple filters | Combined with AND logic |
| No matching records | `data: []`, `pagination.total: 0` — not a 404 |

---

## 10. Attachment File Handling Notes

- On upload, the server assigns a UUID-based `storageFilename` (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf`) that is stored in the database.
- The original filename is stored separately in `originalFilename` and is used only for display and `Content-Disposition` headers on download.
- Files are stored server-side under `uploads/` directory (not publicly accessible; served only through the download endpoint after ownership verification).
- `storageFilename` is never returned in any API response.
- On soft-removal, the physical file is **not** deleted from disk. It becomes inaccessible because the download endpoint checks `removedAt` before serving.

---

## 11. Traceability to Acceptance Criteria

| AC ID | Endpoint(s) | Key Behaviour Verified |
|-------|------------|----------------------|
| AC-01 | POST `/api/tickets` | 201 + ticketNumber returned |
| AC-03 | GET `/api/tickets/:id` | 403 for cross-requester access |
| AC-04 | POST `/api/tickets` | 400 with `fields.summary` error |
| AC-05 | GET `/api/tickets` | Ticket appears in list |
| AC-06 | POST `/api/tickets/:id/attachments` | 400 `FILE_TOO_LARGE` |
| AC-07 | POST `/api/tickets/:id/attachments` | 415 `UNSUPPORTED_FILE_TYPE` |
| AC-08 | POST `/api/tickets/:id/attachments` | 409 `ATTACHMENT_LIMIT_REACHED` |
| AC-09 | GET `.../download` | 200 + binary file |
| AC-10 | DELETE `.../attachments/:id` | 200 + `removedAt` set |
| AC-11 | GET `.../download` (removed) | 410 `ATTACHMENT_REMOVED` |
| AC-12 | GET `/api/tickets?search=` | Filtered results |
| AC-13 | GET `/api/tickets?categoryId=` | Filtered by category |
| AC-14 | GET `/api/tickets?search=zzz` | `data: []`, `total: 0` |
| AC-15 | GET `/api/tickets?page=2` | Correct page 2 data + pagination meta |
| AC-19 | GET `/api/requesters` | Only active requesters returned |
| AC-23 | POST `/api/tickets` | All field errors in one `fields` map |
