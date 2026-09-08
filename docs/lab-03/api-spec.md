# Lab 3 API Specification — TokTickIT REST API (Extended)

All Lab 2 API conventions remain in force (error envelope, status codes, safe errors).
This document covers only Lab 3 additions and changes.
Reference `docs/lab-02/api-spec.md` for the baseline.

---

## 1. Authentication Mechanism

### JWT in httpOnly Cookie

- **Algorithm:** HS256
- **Secret:** `JWT_SECRET` environment variable (never committed)
- **Expiry:** 8 hours
- **Storage:** `httpOnly; Secure; SameSite=Strict` cookie named `tkt_token`
- **Logout:** Token added to an in-memory blocklist; cookie cleared
- **Middleware:** `requireAuth` — validates JWT, checks blocklist, attaches `req.user = { id, name, email, role, mustChangePassword }`
- **Role guard:** `requireRole(...roles)` — checks `req.user.role` against permitted list; returns 403 if not permitted
- **Password-change guard:** `requirePasswordChanged` — returns 403 if `req.user.mustChangePassword === true` (applied after `requireAuth` on all routes except `/api/auth/change-password`)

### Error envelope (same as Lab 2)
```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have permission." } }
```

### HTTP Status Codes (extended)
| Code | Use |
|------|-----|
| 200 | Successful retrieval or update |
| 201 | Resource created |
| 400 | Validation failure |
| 401 | Unauthenticated (missing/invalid/expired JWT) |
| 403 | Authenticated but forbidden (wrong role, mustChangePassword, or self-deactivation guard) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, self-deactivation, last-admin guard, already-resolved) |
| 410 | Gone (soft-removed attachment) |
| 500 | Unexpected server error (safe message only) |

---

## 2. Authentication Endpoints

### 2.1 Login

```
POST /api/auth/login
```

**Request body**
```json
{ "email": "somchai.j@example.com", "password": "Change@123" }
```

**Response — 200 OK** (sets `tkt_token` cookie)
```json
{ "id": 1, "name": "Somchai Jaidee", "role": "REQUESTER", "mustChangePassword": true }
```
- `passwordHash` is **never** returned

**Error cases**

| Scenario | Status | Code |
|----------|--------|------|
| Wrong password or unknown email | 401 | `INVALID_CREDENTIALS` |
| Inactive account | 403 | `ACCOUNT_INACTIVE` |
| Validation (email missing) | 400 | `VALIDATION_ERROR` |

---

### 2.2 Logout

```
POST /api/auth/logout
```
Auth: JWT required

**Response — 200 OK** (clears cookie)
```json
{ "message": "Logged out successfully." }
```

---

### 2.3 Current User

```
GET /api/auth/me
```
Auth: JWT + `requirePasswordChanged`

**Response — 200 OK**
```json
{ "id": 1, "name": "Somchai Jaidee", "email": "somchai.j@example.com", "role": "REQUESTER", "mustChangePassword": false }
```

---

### 2.4 Mandatory Password Change

```
POST /api/auth/change-password
```
Auth: JWT only (no `requirePasswordChanged` guard — this is the route to satisfy it)

**Request body**
```json
{ "currentPassword": "Change@123", "newPassword": "Secure@2026!", "confirmPassword": "Secure@2026!" }
```

**Response — 200 OK**
```json
{ "message": "Password changed successfully." }
```

**Error cases**

| Scenario | Status | Code |
|----------|--------|------|
| Wrong current password | 400 | `VALIDATION_ERROR` |
| New password == current password | 400 | `VALIDATION_ERROR` |
| Complexity rule(s) violated | 400 | `VALIDATION_ERROR` — includes `fields.newPassword` listing violated rules |
| Passwords don't match | 400 | `VALIDATION_ERROR` |

---

## 3. Ticket Endpoints (Lab 2 — updated auth)

All Lab 2 ticket endpoints now require `requireAuth + requirePasswordChanged`.
The `requesterId` query parameter is **ignored**; `req.user.id` is used instead for Requester operations.

| Endpoint | Change from Lab 2 |
|----------|------------------|
| `POST /api/tickets` | Uses `req.user.id` as `requesterId`; client `requesterId` ignored |
| `GET /api/tickets?...` | Uses `req.user.id` as filter; no `requesterId` param accepted |
| `GET /api/tickets/:id` | Requester: own only (403 otherwise); IT Staff/Admin: any ticket |
| All attachment endpoints | Use `req.user.id` for ownership checks |

---

## 4. IT Staff Ticket Queue

```
GET /api/queue
```
Auth: JWT + `requirePasswordChanged` + `requireRole('IT_STAFF', 'ADMINISTRATOR')`

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | ILIKE on ticketNumber + summary |
| `categoryId` | integer | — | Filter by category |
| `requestedPriority` | string | — | LOW/MEDIUM/HIGH/CRITICAL |
| `itPriority` | string | — | LOW/MEDIUM/HIGH/CRITICAL |
| `status` | string | — | Any TicketStatus value |
| `ownerId` | integer or `"unassigned"` | — | Filter by owner; "unassigned" for no owner |
| `sort` | string | `createdAt` | ticketNumber / createdAt / updatedAt |
| `order` | string | `desc` | asc / desc |
| `page` | integer | `1` | 1-based; clamped ≥1 |
| `pageSize` | integer | `10` | Valid: 10, 25, 50; clamped to 10 if invalid |

**Response — 200 OK**
```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TKT-2026-000042",
      "summary": "Laptop battery drains quickly",
      "categoryName": "Hardware",
      "relatedSystemName": "Corporate Laptop",
      "requestedPriority": "MEDIUM",
      "itPriority": "MEDIUM",
      "currentStatus": "IN_PROGRESS",
      "ticketOwner": { "id": 6, "name": "Michael Brown" },
      "requester": { "id": 1, "name": "Somchai Jaidee" },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 87, "totalPages": 9 }
}
```

---

## 5. Ticket Operations (IT Staff)

### 5.1 Claim / Reassign Ticket Owner

```
PATCH /api/tickets/:id/owner
```
Auth: IT Staff, Admin

**Request body**
```json
{ "ownerId": 6 }
```
Set `ownerId: null` to unassign.

**Response — 200 OK** — updated ticket object (same shape as GET /api/tickets/:id).

**Error cases:** 404 ticket not found; 400 if `ownerId` is not an active IT Staff or Admin user.

---

### 5.2 Set IT Priority

```
PATCH /api/tickets/:id/it-priority
```
Auth: IT Staff, Admin

**Request body**
```json
{ "itPriority": "HIGH" }
```

**Response — 200 OK** — updated ticket object.

---

### 5.3 Transition Status

```
PATCH /api/tickets/:id/status
```
Auth: IT Staff, Admin (Requester allowed only for transitions they can initiate — none in Lab 3 beyond problem-appears-resolved)

**Request body**
```json
{ "status": "IN_PROGRESS" }
```

**Response — 200 OK** — updated ticket object.

**Error cases**

| Scenario | Status | Code |
|----------|--------|------|
| Invalid transition per matrix | 400 | `INVALID_TRANSITION` — message lists current and requested status |
| Ticket not found | 404 | `NOT_FOUND` |
| Role not permitted for this transition | 403 | `FORBIDDEN` |

---

### 5.4 Mark Problem Appears Resolved (Requester)

```
POST /api/tickets/:id/requester-resolved
```
Auth: Requester (must own ticket)

**Response — 200 OK**
```json
{ "requesterResolvedAt": "2026-09-08T10:00:00.000Z" }
```

**Error cases**

| Scenario | Status | Code |
|----------|--------|------|
| Already marked | 409 | `ALREADY_RESOLVED` |
| Requester does not own ticket | 403 | `FORBIDDEN` |

---

## 6. Public Comments

### 6.1 Post Public Comment

```
POST /api/tickets/:id/comments
```
Auth: Any role with access to the ticket (Requester: own; IT Staff/Admin: any)

**Request body**
```json
{ "content": "Thank you for the update." }
```

**Response — 201 Created**
```json
{
  "id": 1,
  "ticketId": 42,
  "author": { "id": 1, "name": "Somchai Jaidee", "role": "REQUESTER" },
  "content": "Thank you for the update.",
  "createdAt": "..."
}
```

**Error cases:** 400 empty/whitespace content; 403 Requester accessing non-owned ticket; 404 ticket not found.

---

### 6.2 Get Public Comments

```
GET /api/tickets/:id/comments
```
Auth: Any role with ticket access

**Response — 200 OK**
```json
[
  { "id": 1, "author": { "id": 1, "name": "Somchai Jaidee", "role": "REQUESTER" }, "content": "...", "createdAt": "..." }
]
```
Sorted by `createdAt` ascending.

---

## 7. Internal Notes

### 7.1 Create Internal Note

```
POST /api/tickets/:id/notes
```
Auth: IT Staff, Admin

**Request body**
```json
{ "content": "Customer confirmed issue started after Windows update." }
```

**Response — 201 Created** — same shape as comment but `authorRole` will be IT_STAFF or ADMINISTRATOR.

**Error cases:** 400 empty content; 403 Requester (role not permitted — no note content exposed); 404 ticket not found.

---

### 7.2 Get Internal Notes

```
GET /api/tickets/:id/notes
```
Auth: IT Staff, Admin only (403 for Requester — no note content in error body)

**Response — 200 OK** — array of notes sorted `createdAt` ascending.

---

## 8. Administrator User Management

### 8.1 List Users

```
GET /api/users
```
Auth: Admin only

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Case-insensitive match on name or email |
| `role` | string | REQUESTER / IT_STAFF / ADMINISTRATOR |

**Response — 200 OK**
```json
[
  { "id": 1, "name": "Somchai Jaidee", "email": "somchai.j@example.com", "role": "REQUESTER", "isActive": true, "mustChangePassword": true }
]
```
`passwordHash` never returned. Sorted by `name` ascending.

---

### 8.2 Create User

```
POST /api/users
```
Auth: Admin only

**Request body**
```json
{
  "name": "Alex Thompson",
  "email": "alex.t@example.com",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "Welcome@1!"
}
```

**Response — 201 Created** — user object (no passwordHash).

**Error cases**

| Scenario | Status | Code |
|----------|--------|------|
| Duplicate email | 409 | `DUPLICATE_EMAIL` |
| Invalid role value | 400 | `VALIDATION_ERROR` |
| Missing required field | 400 | `VALIDATION_ERROR` |
| Password complexity violated | 400 | `VALIDATION_ERROR` |

---

### 8.3 Update User

```
PATCH /api/users/:id
```
Auth: Admin only

**Request body** (all fields optional)
```json
{ "name": "Alex T.", "email": "alex.t2@example.com", "role": "REQUESTER", "isActive": false }
```

**Error cases**

| Scenario | Status | Code |
|----------|--------|------|
| Deactivating self | 409 | `SELF_DEACTIVATION` |
| Removing last active Administrator | 409 | `LAST_ADMIN` |
| Duplicate email | 409 | `DUPLICATE_EMAIL` |
| User not found | 404 | `NOT_FOUND` |

---

### 8.4 Set Initial Password

```
POST /api/users/:id/set-password
```
Auth: Admin only

**Request body**
```json
{ "password": "NewTemp@99!" }
```

**Response — 200 OK**
```json
{ "message": "Initial password set. User must change password at next login." }
```
Sets `mustChangePassword = true` on the user.

---

## 9. Error Code Reference (Lab 3 additions)

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Email/password combination not valid (no user enumeration) |
| `ACCOUNT_INACTIVE` | 403 | User account is deactivated |
| `PASSWORD_CHANGE_REQUIRED` | 403 | User must change initial password before accessing this resource |
| `INVALID_TRANSITION` | 400 | Requested status transition is not permitted by the transition matrix |
| `DUPLICATE_EMAIL` | 409 | Email address already in use |
| `SELF_DEACTIVATION` | 409 | Administrator cannot deactivate their own account |
| `LAST_ADMIN` | 409 | Operation would remove the last active Administrator |
| `ALREADY_RESOLVED` | 409 | Requester already marked this ticket as resolved |

---

## 10. Endpoint Summary Table

| Method | Path | Auth | Role | Purpose |
|--------|------|------|------|---------|
| POST | `/api/auth/login` | None | Any | Login |
| POST | `/api/auth/logout` | JWT | Any | Logout |
| GET | `/api/auth/me` | JWT + PwdChg | Any | Current user |
| POST | `/api/auth/change-password` | JWT | Any | Change initial password |
| POST | `/api/tickets` | JWT + PwdChg | Requester | Create ticket |
| GET | `/api/tickets` | JWT + PwdChg | Requester | My tickets |
| GET | `/api/tickets/:id` | JWT + PwdChg | R/S/A | Get one ticket |
| POST | `/api/tickets/:id/attachments` | JWT + PwdChg | Requester | Upload attachment |
| GET | `/api/tickets/:id/attachments/:aid/download` | JWT + PwdChg | R/S/A | Download attachment |
| DELETE | `/api/tickets/:id/attachments/:aid` | JWT + PwdChg | Requester | Soft-remove attachment |
| GET | `/api/queue` | JWT + PwdChg | Staff, Admin | IT Staff Queue |
| PATCH | `/api/tickets/:id/owner` | JWT + PwdChg | Staff, Admin | Claim/reassign owner |
| PATCH | `/api/tickets/:id/it-priority` | JWT + PwdChg | Staff, Admin | Set IT Priority |
| PATCH | `/api/tickets/:id/status` | JWT + PwdChg | Staff, Admin | Transition status |
| POST | `/api/tickets/:id/comments` | JWT + PwdChg | R/S/A | Post Public Comment |
| GET | `/api/tickets/:id/comments` | JWT + PwdChg | R/S/A | Get Public Comments |
| POST | `/api/tickets/:id/notes` | JWT + PwdChg | Staff, Admin | Create Internal Note |
| GET | `/api/tickets/:id/notes` | JWT + PwdChg | Staff, Admin | Get Internal Notes |
| POST | `/api/tickets/:id/requester-resolved` | JWT + PwdChg | Requester | Mark problem resolved |
| GET | `/api/users` | JWT + PwdChg | Admin | List users |
| POST | `/api/users` | JWT + PwdChg | Admin | Create user |
| PATCH | `/api/users/:id` | JWT + PwdChg | Admin | Update user |
| POST | `/api/users/:id/set-password` | JWT + PwdChg | Admin | Set initial password |
| GET | `/api/categories` | JWT + PwdChg | Any | List categories |
| GET | `/api/related-systems` | JWT + PwdChg | Any | List related systems |

> **Legend:** R = Requester, S = IT Staff, A = Admin; PwdChg = `requirePasswordChanged` guard applied
