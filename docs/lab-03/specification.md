# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Replace the temporary Development Requester selector with real JWT-based authentication and role-based authorization, introduce the IT Staff Ticket Queue and Ticket Detail workflow (claim/reassign, IT Priority, status transitions, Public Comments, Internal Notes), add the minimalist Administrator User Management screen, and migrate all Lab 2 Requester functions to use the authenticated identity — without discarding any existing Ticket or Attachment data.

---

## 2. Stakeholder Request Interpretation

The system now needs real users with passwords. An Administrator manages user accounts (create, edit, activate/deactivate, set initial password). Users sign in with email and password; those with an initial password must change it before entering the application. Each role sees only what it is permitted to do. Requesters continue using the Lab 2 ticket functions, but their identity now comes from the authenticated session rather than a localStorage selector. IT Staff get a professional Ticket Queue and an extended Ticket Detail where they can claim/reassign tickets, set IT Priority, transition status through a defined workflow, and communicate via Public Comments and Internal Notes. Hiding a button is not authorization — every protected operation is enforced server-side.

---

## 3. Scope

### Included
- JWT-based login, logout, current-user retrieval, and mandatory first-login password change
- Role-based navigation and server-side authorization for Requester, IT Staff, and Administrator
- Migration: `DevRequester` records → real `User` model; existing Ticket ownership preserved
- Removal of Development Requester selector and `localStorage` identity from the frontend
- All Lab 2 Requester Ticket and Attachment functions using authenticated identity
- IT Staff Ticket Queue with search, filter, sort, and pagination
- IT Staff Ticket Detail: claim/reassign ownership, IT Priority, permitted status changes
- Public Comments (Requester + IT Staff + Admin visible) and Internal Notes (IT Staff + Admin only)
- "Problem Appears Resolved" action available to the Requester
- Minimalist Administrator User Management: list, create, edit, activate/deactivate, set initial password
- Lab 2 regression: all existing Ticket, Attachment, Category, and RelatedSystem data unaffected
- Zen Green UI extended for Login, Change Password, IT Staff Queue, IT Staff Ticket Detail, User Management
- Idempotent seed with realistic users, tickets, comments, and notes

### Excluded
- Email invitations, password-reset email, multi-factor authentication, social login, SSO
- Self-registration and Requester-created accounts
- Actions Taken by IT Staff (deferred to Lab 4)
- Formal SLA calculation, escalation rules, notification services
- Dashboards and KPI analytics beyond simple queue counts
- Multi-tenant organizations, departments, and customer administration
- Production-grade deployment or cloud infrastructure changes
- Multiple roles assigned to one user
- User deletion, bulk user operations, user import/export, account-history screens
- Department, profile-photo, or other extended user-profile management
- Email delivery of initial passwords or reset links
- Account unlocking, administrator approval workflows, and advanced identity management
- Advanced user-list features: mandatory pagination, multi-column sorting, multiple simultaneous filters

---

## 4. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | The system shall accept a user's email and password and return a signed JWT on successful authentication. |
| FR-02 | The JWT shall be stored in an `httpOnly` cookie and expire after 8 hours; logout invalidates it server-side (blocklist) and clears the cookie. |
| FR-03 | Every protected API endpoint shall verify the JWT and return 401 Unauthenticated if absent or invalid. |
| FR-04 | A user whose `mustChangePassword` flag is true shall be redirected to the mandatory Change Password screen and cannot access any other route until a valid new password is saved. |
| FR-05 | The application shell shall display the authenticated user's name and role badge; it shall show only the navigation links permitted for that role. |
| FR-06 | The DevRequester selector and Change Requester action shall be removed entirely from the frontend. |
| FR-07 | All Lab 2 Requester Ticket and Attachment endpoints shall use `req.user.id` (from JWT) as the requester identity; any client-supplied `requesterId` parameter shall be ignored. |
| FR-08 | An authenticated Requester shall access Create Ticket, My Tickets, and Ticket Detail using their authenticated identity; ownership protection from Lab 2 is preserved. |
| FR-09 | IT Staff shall access a Ticket Queue showing all tickets, with search (Ticket Number, Summary), filters (Category, Requested Priority, IT Priority, Current Status, Ticket Owner), sort (Ticket Number, Created Date, Last Updated), and pagination (default page 10, max 50). |
| FR-10 | IT Staff shall be able to claim an unassigned or already-owned ticket by setting themselves as Ticket Owner. |
| FR-11 | IT Staff shall be able to reassign a ticket to any other active IT Staff or Administrator user. |
| FR-12 | IT Staff shall be able to set or change IT Priority on any ticket. |
| FR-13 | IT Staff shall perform permitted status transitions as defined in the transition matrix (BR-16). |
| FR-14 | Any authenticated user (Requester, IT Staff, Administrator) may post a Public Comment on a ticket they are permitted to view. |
| FR-15 | IT Staff and Administrator may create Internal Notes on a ticket; Internal Notes are invisible to Requesters. |
| FR-16 | A Requester may click "Problem Appears Resolved" to indicate the issue appears fixed; this does not formally change ticket status but sets a `requesterResolvedAt` timestamp. |
| FR-17 | An Administrator may view the full user list with optional name/email search and optional role filter. |
| FR-18 | An Administrator may create a user with: full name, email, one role, active/inactive state, and an initial password that must be changed at first login. |
| FR-19 | An Administrator may edit a user's name, email, role, and activation state. |
| FR-20 | An Administrator may set a new initial password for any user; `mustChangePassword` is reset to true. |
| FR-21 | An Administrator may not deactivate their own account. |
| FR-22 | An Administrator may not deactivate or alter the last remaining active Administrator account. |
| FR-23 | Duplicate email addresses shall be rejected with a 409 Conflict response. |
| FR-24 | The system shall prevent deactivated users from authenticating. |
| FR-25 | All API errors shall remain safe (no stack traces); the frontend shall handle loading, saving, success, forbidden, not-found, conflict, and failure states. |

---

## 5. Business Rules

| ID | Rule |
|----|------|
| BR-01 | Only an active user (`isActive = true`) with valid credentials may authenticate. |
| BR-02 | A user whose `mustChangePassword = true` cannot enter the normal application until a new valid password is saved. The Change Password screen is the only screen accessible in this state. |
| BR-03 | The authenticated user identity from the JWT (not any requesterId in the request body or query) determines ownership for all Requester operations. |
| BR-04 | Public Comments are visible to the Requester who owns the ticket, to all IT Staff, and to Administrators. Internal Notes are visible only to IT Staff and Administrators. |
| BR-05 | A Requester may indicate that the problem appears resolved (set `requesterResolvedAt`), but cannot formally set the ticket to Resolved or Closed. |
| BR-06 | Passwords must be hashed with bcrypt (minimum cost factor 12) before storage. Plaintext passwords must never be stored or logged. |
| BR-07 | JWT secret must be stored in an environment variable and must never be committed to source control. |
| BR-08 | A login attempt with invalid credentials returns a generic 401 response that does not distinguish "email not found" from "wrong password" (to prevent user enumeration). |
| BR-09 | A login attempt against an inactive account returns a 403 response with a clear but non-enumeration-safe message. |
| BR-10 | New password rules: minimum 8 characters; must include at least one uppercase letter, one lowercase letter, one digit, and one special character. |
| BR-11 | New password must differ from the current (initial) password. |
| BR-12 | IT Priority initially copies Requested Priority when a ticket is created. It may subsequently be changed only by IT Staff or Administrator. |
| BR-13 | Each Ticket may have zero or one Ticket Owner. The Ticket Owner must be an active IT Staff or Administrator user. |
| BR-14 | IT Staff and Administrators may claim or reassign a ticket. A Requester may not set the Ticket Owner. |
| BR-15 | Requested Priority remains the value submitted by the Requester and is never changed after ticket creation. |
| BR-16 | **Status Transition Matrix** — Permitted transitions and roles: |

### BR-16 Status Transition Matrix

| From Status | To Status | Permitted Roles | Notes |
|-------------|-----------|-----------------|-------|
| NEW | OPEN | IT Staff, Admin | Ticket is acknowledged |
| NEW | CANCELLED | IT Staff, Admin | Rejected before work begins |
| OPEN | IN_PROGRESS | IT Staff, Admin | Work started |
| OPEN | WAITING_FOR_REQUESTER | IT Staff, Admin | Awaiting Requester input |
| OPEN | CANCELLED | IT Staff, Admin | |
| IN_PROGRESS | WAITING_FOR_REQUESTER | IT Staff, Admin | |
| IN_PROGRESS | RESOLVED | IT Staff, Admin | |
| IN_PROGRESS | CANCELLED | IT Staff, Admin | |
| WAITING_FOR_REQUESTER | IN_PROGRESS | IT Staff, Admin | Requester responded |
| WAITING_FOR_REQUESTER | RESOLVED | IT Staff, Admin | |
| RESOLVED | CLOSED | IT Staff, Admin | Formally closed |
| RESOLVED | REOPENED | Requester, IT Staff, Admin | Problem not fixed |
| CLOSED | REOPENED | Requester, IT Staff, Admin | |
| REOPENED | IN_PROGRESS | IT Staff, Admin | |
| REOPENED | CANCELLED | IT Staff, Admin | |

| ID | Rule (continued) |
|----|-----------------|
| BR-17 | Both Public Comments and Internal Notes are append-only in Lab 3. Editing and deletion are excluded. |
| BR-18 | Public Comment and Internal Note content is required; whitespace-only content is rejected. Max length: 2000 characters, trimmed before save. |
| BR-19 | Each Comment or Note records `authorId` and `createdAt` from the backend; the client cannot supply these values. |
| BR-20 | An Administrator cannot deactivate their own account (self-deactivation is blocked). |
| BR-21 | The system must always retain at least one active Administrator. Any operation that would result in zero active Administrators is rejected with a 409 Conflict. |
| BR-22 | User email addresses are case-insensitive and unique across the system (stored in lowercase). |
| BR-23 | Seeded credentials are for local development only and must be documented in `docs/lab-03/specification.md`. No real personal passwords may be committed. |
| BR-24 | `DevRequester` records from Lab 2 are migrated to `User` records with role `REQUESTER`. Each migrated user receives a known initial password (e.g. `Change@123`) with `mustChangePassword = true`. Existing Ticket foreign keys are updated to reference the new `User` records. |
| BR-25 | The `DevRequester` table is dropped after successful migration; the `requesterId` FK on `Ticket` now references `User`. |

---

## 6. UI Specification Summary

Full detail is in `docs/lab-03/ui-spec.md`. Summary:

### Application Shell (extended from Lab 2)
- Replace Dev Requester display with authenticated user's name + role badge
- Show role-specific navigation only (Requester: My Tickets + Create Ticket; IT Staff: My Queue + Create Ticket; Admin: Admin panel)
- Add Logout action in the user profile dropdown
- Keep all Lab 2 Zen Green tokens, form conventions, badges, and responsive rules

### Login Screen
- Route: `/login` (unauthenticated default)
- Fields: Email, Password (show/hide toggle)
- States: initial, validating, busy (Submit disabled + spinner), invalid credentials (generic error), inactive account, success (redirect)

### Change Password Screen
- Route: `/change-password` (only accessible when `mustChangePassword = true`)
- Fields: Current Password, New Password, Confirm New Password
- Live password-rule checklist: ≥8 chars, uppercase, lowercase, digit, special char
- States: initial, validating, busy, success (redirect to home)

### Requester Screens (extended from Lab 2)
- All Lab 2 screens preserved; Dev Requester selector removed
- Ticket Detail adds: Public Comments section (add + list), "Problem Appears Resolved" button (visible once, disabled after use)

### IT Staff Ticket Queue
- Route: `/queue`
- Sortable table (desktop) / cards (mobile): Ticket No., Created Date, Summary, Category, Req. Priority, IT Priority, Status, Ticket Owner, Last Updated
- Search bar, filter dropdowns, Clear Filters button, Create Ticket button
- Loading / empty / no-results / error states

### IT Staff Ticket Detail
- Route: `/tickets/:id` (IT Staff view)
- Editable fields: Ticket Owner (dropdown of active IT Staff + Admin), IT Priority (dropdown), Current Status (dropdown constrained by transition matrix)
- Read-only fields: all Requester-supplied fields
- Tabs or sections: Public Comments | Internal Notes | Attachments
- Public Comments: add + list (visible to all); Internal Notes: add + list (IT Staff + Admin only, visually distinct)
- Save Changes button with busy/success/error state

### Administrator User Management
- Route: `/admin/users`
- User list: Name, Email, Role badge, Status badge, Edit button
- Search by name or email
- Optional role filter
- Create User panel / Edit User panel (slide-in or modal): Full Name, Email, Role dropdown, Active toggle, Set Initial Password section
- Safety guards: self-deactivation blocked, last-active-Admin blocked

### Responsive
- Same breakpoints as Lab 2: desktop ≥992 px, tablet 768–991 px, mobile <768 px
- IT Staff Queue: table on desktop, cards on mobile
- All forms usable on mobile

---

## 7. Data Changes

### New enum

```prisma
enum UserRole {
  REQUESTER
  IT_STAFF
  ADMINISTRATOR
}

enum TicketStatus {
  NEW
  OPEN
  IN_PROGRESS
  WAITING_FOR_REQUESTER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED
}
```

### New model: `User`

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int PK autoincrement | |
| `name` | String | max 100 |
| `email` | String unique | stored lowercase |
| `passwordHash` | String | bcrypt, never returned to client |
| `role` | UserRole | REQUESTER / IT_STAFF / ADMINISTRATOR |
| `isActive` | Boolean default true | |
| `mustChangePassword` | Boolean default true | set to false after first change |
| `createdAt` | DateTime default now | |
| `updatedAt` | DateTime updatedAt | |

Indexes: `email`, `role`, `isActive`.

### Modified model: `Ticket`

| Change | Detail |
|--------|--------|
| `requesterId` FK | now references `User.id` (migrated from `DevRequester.id`) |
| `ticketOwnerId` | Int? nullable FK → `User.id`; the assigned IT Staff or Administrator |
| `itPriority` | Priority enum, default copies `requestedPriority` at creation |
| `currentStatus` | TicketStatus enum (expanded from Lab 2 single-value enum) |
| `requesterResolvedAt` | DateTime? nullable; set by Requester's "Problem Appears Resolved" action |

### New model: `PublicComment`

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int PK autoincrement | |
| `ticketId` | Int FK → Ticket.id | index |
| `authorId` | Int FK → User.id | |
| `content` | String | max 2000, trimmed |
| `createdAt` | DateTime default now | |

### New model: `InternalNote`

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int PK autoincrement | |
| `ticketId` | Int FK → Ticket.id | index |
| `authorId` | Int FK → User.id | |
| `content` | String | max 2000, trimmed |
| `createdAt` | DateTime default now | |

### Dropped model: `DevRequester`

Dropped after migration. All FK references on `Ticket` point to `User`.

### Migration strategy

1. **Migration 1**: Add `User` model and enums; add `ticketOwnerId`, `itPriority`, `requesterResolvedAt` to `Ticket`; add `PublicComment` and `InternalNote` models.
2. **Migration 2**: Copy `DevRequester` rows into `User` (role = REQUESTER, `mustChangePassword` = true, `passwordHash` = bcrypt("Change@123")). Update `Ticket.requesterId` FK to reference `User.id` via a mapping.
3. **Migration 3**: Drop `DevRequester` table and `DevRequester` model from schema.

### Seed Data

| Account | Email | Password | Role | mustChangePassword |
|---------|-------|----------|------|--------------------|
| Somchai Jaidee | somchai.j@example.com | Change@123 | REQUESTER | true |
| Nattaporn Srisuk | nattaporn.s@example.com | Change@123 | REQUESTER | true |
| Wiroj Tanaka | wiroj.t@example.com | Change@123 | REQUESTER | true |
| Araya Phongphan | araya.p@example.com | Change@123 | REQUESTER | true |
| Prayut Mahachai | prayut.m@example.com | Change@123 | REQUESTER (inactive) | true |
| Michael Brown | michael.b@example.com | Staff@123! | IT_STAFF | false |
| Sarah Johnson | sarah.j@example.com | Staff@123! | IT_STAFF | false |
| David Lee | david.l@example.com | Staff@123! | IT_STAFF | false |
| Kevin Patel | kevin.p@example.com | Staff@123! | IT_STAFF (inactive) | false |
| Admin User | admin@example.com | Admin@123! | ADMINISTRATOR | false |

> **Security note**: These credentials are for local development and testing only. They must not be used in any production environment.

---

## 8. API Contract

Full detail in `docs/lab-03/api-spec.md`. Summary of new/changed endpoints:

| Method | Path | Auth | Role | Purpose |
|--------|------|------|------|---------|
| POST | `/api/auth/login` | None | Any | Login; returns JWT in httpOnly cookie |
| POST | `/api/auth/logout` | JWT | Any | Logout; clears cookie and invalidates token |
| GET | `/api/auth/me` | JWT | Any | Return current user identity and role |
| POST | `/api/auth/change-password` | JWT | Any | Mandatory first-login password change |
| GET | `/api/tickets` | JWT | Requester | My Tickets (own only) |
| POST | `/api/tickets` | JWT | Requester | Create Ticket |
| GET | `/api/tickets/:id` | JWT | Requester/Staff/Admin | Get one ticket (ownership enforced per role) |
| GET | `/api/queue` | JWT | IT Staff, Admin | IT Staff Ticket Queue (all tickets) |
| PATCH | `/api/tickets/:id/owner` | JWT | IT Staff, Admin | Claim or reassign Ticket Owner |
| PATCH | `/api/tickets/:id/it-priority` | JWT | IT Staff, Admin | Set IT Priority |
| PATCH | `/api/tickets/:id/status` | JWT | IT Staff, Admin | Transition status (matrix enforced) |
| POST | `/api/tickets/:id/comments` | JWT | Requester/Staff/Admin | Post Public Comment |
| GET | `/api/tickets/:id/comments` | JWT | Requester/Staff/Admin | Get Public Comments |
| POST | `/api/tickets/:id/notes` | JWT | IT Staff, Admin | Create Internal Note |
| GET | `/api/tickets/:id/notes` | JWT | IT Staff, Admin | Get Internal Notes |
| POST | `/api/tickets/:id/requester-resolved` | JWT | Requester (owner) | Mark "Problem Appears Resolved" |
| GET | `/api/users` | JWT | Admin | List users (search + optional role filter) |
| POST | `/api/users` | JWT | Admin | Create user |
| PATCH | `/api/users/:id` | JWT | Admin | Update user (name, email, role, isActive) |
| POST | `/api/users/:id/set-password` | JWT | Admin | Set new initial password |

All Lab 2 Attachment endpoints (`/api/tickets/:id/attachments/...`) remain unchanged except the `requesterId` parameter is now derived from JWT.

---

## 9. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | Given an active user with valid credentials, when login is submitted, then a JWT is issued in an httpOnly cookie and the correct role-based home screen is shown. |
| AC-02 | Given a user with `mustChangePassword = true`, when login succeeds, then the Change Password screen is shown and no other route is accessible until a valid new password is saved. |
| AC-03 | Given an authenticated Requester, when any ticket or attachment endpoint is called with a different requesterId in the body, then the backend ignores the supplied value and uses the JWT identity. |
| AC-04 | Given a Requester account, when `GET /api/tickets/:id/notes` is called, then 403 Forbidden is returned and no note content is exposed. |
| AC-05 | Given valid logout, when a previously issued JWT is used on a protected endpoint, then 401 Unauthorized is returned. |
| AC-06 | Given an inactive account, when login is attempted, then 403 is returned with a safe message (no credential detail). |
| AC-07 | Given an IT Staff user, when the Ticket Queue is loaded, then all tickets (not just owned) are returned with correct search, filter, sort, and pagination. |
| AC-08 | Given an IT Staff user, when claiming an unassigned ticket, then `ticketOwnerId` is set to that user's id and a 200 response is returned. |
| AC-09 | Given an IT Staff user, when a status transition outside the allowed matrix is attempted, then 400 is returned with a descriptive error. |
| AC-10 | Given a Requester, when a Public Comment is posted, then it is visible to IT Staff and Administrators; when an Internal Note endpoint is called, then 403 is returned. |
| AC-11 | Given an Administrator, when a new user is created with duplicate email, then 409 Conflict is returned and no user is created. |
| AC-12 | Given an Administrator, when self-deactivation is attempted, then 409 Conflict is returned. |
| AC-13 | Given an Administrator, when deactivating the last active Administrator, then 409 Conflict is returned. |
| AC-14 | Given a new initial password is set for a user, when that user logs in, then they are redirected to Change Password before accessing any other screen. |
| AC-15 | Given a Requester, when "Problem Appears Resolved" is clicked, then `requesterResolvedAt` is set; clicking again is blocked (idempotent). |
| AC-16 | Given an existing Lab 2 ticket, after migration, then its `requesterId` correctly references the migrated User record and the ticket remains accessible to that Requester. |
| AC-17 | Given a non-Administrator authenticated user, when any `/api/users` endpoint is called, then 403 Forbidden is returned. |
| AC-18 | Given a non-IT Staff / non-Administrator user, when `GET /api/queue` is called, then 403 Forbidden is returned. |
| AC-19 | Given the Create Ticket form is submitted by a Requester, then the ticket is created using the authenticated user's id (not a client-supplied requesterId). |
| AC-20 | Given a password change with a new password that is the same as the current password, then 400 Bad Request is returned. |
| AC-21 | Given a new password that does not meet the complexity rules, then 400 is returned with the specific rule(s) violated. |

---

## 10. Definition of Done

### Part 1 — Product Completion
- [ ] All FR-01 to FR-25 implemented and verifiable
- [ ] All BR-01 to BR-25 enforced by both frontend and backend
- [ ] All AC-01 to AC-21 satisfied and linked to passing tests
- [ ] All planned automated tests pass (unit, API, UI, auth/security, E2E) from documented commands on `main`
- [ ] No required test is skipped, disabled, or commented out
- [ ] Lab 2 regression: all existing Ticket and Attachment functions work using authenticated identity
- [ ] `DevRequester` table dropped; migration verified on a clean database
- [ ] JWT stored in httpOnly cookie; secret in env variable not committed
- [ ] Passwords hashed with bcrypt; no plaintext in DB, logs, or responses
- [ ] Role-based navigation: each role sees only permitted nav items
- [ ] Server-side authorization on every protected endpoint (hiding a button is not authorization)
- [ ] Transition matrix enforced server-side; invalid transitions return 400
- [ ] Internal Notes invisible to Requesters (403 returned, no note content leaked)
- [ ] Administrator safety rules enforced (self-deactivation, last-admin-protection)
- [ ] UI: loading, saving, success, forbidden, not-found, conflict, and failure states handled
- [ ] Responsive at desktop, tablet, and mobile for all new screens
- [ ] Screenshots captured in `artifacts/lab-03/screenshots/`
- [ ] `docs/lab-03/reviewer.md` and `docs/lab-03/ai-use.md` completed
- [ ] README updated with Lab 3 setup, seeded credentials (dev only), and test commands

### Part 2 — Course Delivery
- [ ] GitHub Issues created and tracked in Kanban (Backlog → Done)
- [ ] All issues implemented on `feature/*` branches, never directly on `lab3-staging` or `main`
- [ ] Each feature branch merged into `lab3-staging` via peer-reviewed Pull Request
- [ ] One release PR from `lab3-staging` → `main` after integration testing
- [ ] `docs/lab-03/reviewer.md` completed with reviewer identity, PR links, comments, responses, approvals
- [ ] `docs/lab-03/ai-use.md` completed with LLM used, key prompts table, and reflection
- [ ] PDF submitted with Answer Part 1 through Answer Part 9

---

## 11. Assumptions and Decisions

| # | Decision | Justification |
|---|----------|---------------|
| 1 | JWT in httpOnly cookie (not localStorage) | Protects against XSS; simpler than refresh-token rotation for a course project; matches the Node.js/Express stack. |
| 2 | Token blocklist stored in memory (Set) with TTL cleanup | Sufficient for course-scale logout invalidation without Redis dependency. In production, Redis would replace this. |
| 3 | bcrypt cost factor 12 | Balance between security and server response time in a dev environment (≈250 ms per hash). |
| 4 | `DevRequester` → `User` migration uses known initial password `Change@123` | All migrated Requesters must change password at first login (BR-24). Documented here; not a secret. |
| 5 | Single `GET /api/tickets` endpoint serves both Requester (own only) and IT Staff (all) based on JWT role | Reduces endpoint sprawl; role is checked server-side. |
| 6 | `GET /api/queue` is a separate endpoint from `GET /api/tickets` | Keeps Requester and IT Staff query contracts distinct; IT Staff queue has different filters and sort options. |
| 7 | `TicketStatus` enum expanded in Lab 3 migration | Lab 2 had a single `NEW` value; adding new statuses is a non-breaking Prisma migration (new enum values). |
| 8 | `itPriority` defaults to `requestedPriority` at ticket creation | Ensures every ticket has an IT Priority from day one; IT Staff can adjust later. |
| 9 | "Problem Appears Resolved" sets `requesterResolvedAt` but does not change `currentStatus` | Keeps formal status control with IT Staff (BR-05); the timestamp is visible to IT Staff as a signal. |
| 10 | Administrator User Management does not require pagination | Lab sheet §8.5 explicitly excludes pagination for the user list. A simple list with search is sufficient. |
