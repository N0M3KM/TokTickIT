# Lab 3 Test Plan and Results

## 1. Test Strategy

All tests are planned from `specification.md` AC-01–AC-21 and the Business Rules before implementation. Test levels: Unit, API/Integration, UI Component, UI Style, Security/Authorization, Migration/Regression, and E2E. No test may be reconstructed after the fact.

### Tools
| Level | Tool |
|-------|------|
| Unit | Vitest (server-side) |
| API / Security | Vitest + Supertest |
| UI Component / Style | Vitest + React Testing Library |
| E2E / Responsive | Playwright |

---

## 2. Planned Tests

### Unit Tests

| Test ID | Type | Req / AC | What It Tests | Expected Result | Test File | Final |
|---------|------|----------|---------------|-----------------|-----------|-------|
| UNIT-01 | Unit | BR-06 | bcrypt hash is not plaintext | hash !== password; bcrypt.compare passes | `server/tests/lab-03/auth.unit.test.ts` | |
| UNIT-02 | Unit | BR-10 | Password complexity validator — valid password | Returns null (no error) | `server/tests/lab-03/auth.unit.test.ts` | |
| UNIT-03 | Unit | BR-10 | Password complexity — missing uppercase | Returns error listing uppercase rule | `server/tests/lab-03/auth.unit.test.ts` | |
| UNIT-04 | Unit | BR-10 | Password complexity — too short (<8 chars) | Returns error | `server/tests/lab-03/auth.unit.test.ts` | |
| UNIT-05 | Unit | BR-16 | Transition matrix — valid transition NEW→OPEN | Returns allowed: true | `server/tests/lab-03/ticket-status.unit.test.ts` | |
| UNIT-06 | Unit | BR-16 | Transition matrix — invalid transition CLOSED→NEW | Returns allowed: false | `server/tests/lab-03/ticket-status.unit.test.ts` | |
| UNIT-07 | Unit | BR-18 | Comment/Note content validation — whitespace only | Returns validation error | `server/tests/lab-03/comment-validation.unit.test.ts` | |
| UNIT-08 | Unit | BR-22 | Email normalisation — uppercase email stored lowercase | Returns lowercase email | `server/tests/lab-03/auth.unit.test.ts` | |

### API Tests

| Test ID | Type | Req / AC | What It Tests | Expected Result | Test File | Final |
|---------|------|----------|---------------|-----------------|-----------|-------|
| API-01 | API | AC-01 | Valid login | 200; httpOnly cookie set; `{ id, name, role }` returned; no passwordHash | `server/tests/lab-03/auth.api.test.ts` | |
| API-02 | API | BR-08 | Login with wrong password | 401 generic message; no user detail | `server/tests/lab-03/auth.api.test.ts` | |
| API-03 | API | BR-08 | Login with unknown email | 401 same generic message as wrong password | `server/tests/lab-03/auth.api.test.ts` | |
| API-04 | API | AC-06, BR-09 | Login with inactive account | 403 with safe message | `server/tests/lab-03/auth.api.test.ts` | |
| API-05 | API | AC-05 | Logout; then use old JWT | 200 on logout; 401 on subsequent protected request | `server/tests/lab-03/auth.api.test.ts` | |
| API-06 | API | FR-03 | Request protected endpoint with no JWT | 401 Unauthenticated | `server/tests/lab-03/authorization.api.test.ts` | |
| API-07 | API | AC-17 | Non-Admin calls `GET /api/users` | 403 Forbidden | `server/tests/lab-03/authorization.api.test.ts` | |
| API-08 | API | AC-04, AC-18 | Requester calls `GET /api/tickets/:id/notes` | 403 Forbidden; no note content returned | `server/tests/lab-03/authorization.api.test.ts` | |
| API-09 | API | AC-18 | Non-IT-Staff calls `GET /api/queue` | 403 Forbidden | `server/tests/lab-03/authorization.api.test.ts` | |
| API-10 | API | AC-03 | Requester calls `POST /api/tickets` with foreign requesterId in body | Ticket created using JWT identity; supplied requesterId ignored | `server/tests/lab-03/auth.api.test.ts` | |
| API-11 | API | AC-07, FR-09 | IT Staff calls `GET /api/queue` with search param | 200; returns filtered results; pagination metadata correct | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-12 | API | FR-09 | IT Staff queue — filter by category | 200; only matching tickets returned | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-13 | API | FR-09 | IT Staff queue — filter by status | 200; only matching tickets returned | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-14 | API | FR-09 | IT Staff queue — pagination | 200; correct page + totalPages metadata | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-15 | API | AC-08 | IT Staff claims unassigned ticket | 200; `ticketOwnerId` set to caller's id | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-16 | API | FR-12 | IT Staff sets IT Priority | 200; `itPriority` updated | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-17 | API | AC-09 | Invalid status transition attempted | 400; descriptive error; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-18 | API | FR-13 | Valid status transition NEW→OPEN | 200; `currentStatus` updated | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-19 | API | AC-10 | Requester posts Public Comment | 201; comment stored; visible to IT Staff | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-20 | API | BR-17 | IT Staff posts Internal Note | 201; note stored; not returned to Requester | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-21 | API | BR-18 | Post whitespace-only Public Comment | 400 validation error | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-22 | API | AC-15 | Requester marks "Problem Appears Resolved" | 200; `requesterResolvedAt` set; second call returns 409 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-23 | API | AC-11 | Admin creates user with duplicate email | 409 Conflict; no user created | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-24 | API | AC-12 | Admin deactivates own account | 409 Conflict | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-25 | API | AC-13 | Admin deactivates last active Administrator | 409 Conflict | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-26 | API | AC-14 | Admin sets new initial password; user logs in | User redirected to Change Password | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-27 | API | FR-17 | Admin lists users with name search | 200; filtered user list | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-28 | API | FR-17 | Admin lists users with role filter | 200; only matching role returned | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-29 | API | AC-20 | Change password where new == current | 400 Bad Request | `server/tests/lab-03/auth.api.test.ts` | |
| API-30 | API | AC-21 | Change password — complexity rule violated | 400 with specific rule(s) listed | `server/tests/lab-03/auth.api.test.ts` | |
| API-31 | API | AC-02, BR-02 | Authenticated user with mustChangePassword accesses protected route | 403; redirected to change-password | `server/tests/lab-03/auth.api.test.ts` | |
| API-32 | API | AC-19 | Requester creates ticket; ticket.requesterId = authenticated user id | 201; requesterId matches JWT user | `server/tests/lab-03/auth.api.test.ts` | |

### UI Component Tests

| Test ID | Type | Req / AC | What It Tests | Expected Result | Test File | Final |
|---------|------|----------|---------------|-----------------|-----------|-------|
| UI-01 | UI | FR-01 | Login form — empty email submit | Email field error shown; API not called | `client/src/lab-03/Login.test.tsx` | |
| UI-02 | UI | AC-01 | Login form — valid submit | Calls POST /api/auth/login; navigates on success | `client/src/lab-03/Login.test.tsx` | |
| UI-03 | UI | API-02 | Login form — invalid credentials response | Generic error message shown | `client/src/lab-03/Login.test.tsx` | |
| UI-04 | UI | FR-04 | Login busy state | Submit button disabled + spinner during in-flight | `client/src/lab-03/Login.test.tsx` | |
| UI-05 | UI | AC-02 | Change Password screen renders when mustChangePassword | Change Password screen shown; other routes blocked | `client/src/lab-03/ChangePassword.test.tsx` | |
| UI-06 | UI | BR-10 | Change Password — live rule checklist | All 4 rules shown; green checkmarks as password typed | `client/src/lab-03/ChangePassword.test.tsx` | |
| UI-07 | UI | AC-20 | Change Password — new == current | Error shown; not submitted | `client/src/lab-03/ChangePassword.test.tsx` | |
| UI-08 | UI | FR-05, FR-06 | App shell shows correct name + role badge | Name and role badge visible after login | `client/src/lab-03/AppShell.test.tsx` (extended) | |
| UI-09 | UI | FR-09 | IT Staff Queue renders ticket list | Ticket rows rendered with correct badges | `client/src/lab-03/StaffTicketQueue.test.tsx` | |
| UI-10 | UI | FR-09 | IT Staff Queue — loading state | Spinner shown while fetching | `client/src/lab-03/StaffTicketQueue.test.tsx` | |
| UI-11 | UI | FR-09 | IT Staff Queue — no-results state | "No tickets match" + Clear Filters button | `client/src/lab-03/StaffTicketQueue.test.tsx` | |
| UI-12 | UI | FR-09 | IT Staff Queue — error state | Error message + retry | `client/src/lab-03/StaffTicketQueue.test.tsx` | |
| UI-13 | UI | AC-10 | IT Staff Ticket Detail — Public Comments visible | Comment list + add form rendered | `client/src/lab-03/StaffTicketDetail.test.tsx` | |
| UI-14 | UI | BR-04 | IT Staff Ticket Detail — Internal Notes visible to Staff | Internal Notes section rendered for IT Staff | `client/src/lab-03/StaffTicketDetail.test.tsx` | |
| UI-15 | UI | BR-04 | Requester Ticket Detail — Internal Notes section absent | Internal Notes tab/section not rendered | `client/src/lab-03/StaffTicketDetail.test.tsx` | |
| UI-16 | UI | AC-15 | Requester Ticket Detail — "Problem Appears Resolved" button | Button present; disabled after use | `client/src/lab-03/StaffTicketDetail.test.tsx` | |
| UI-17 | UI | FR-17 | User Management — user list renders | Name, Email, Role badge, Status badge, Edit button | `client/src/lab-03/UserManagement.test.tsx` | |
| UI-18 | UI | AC-12 | User Management — self-deactivation blocked | Deactivate toggle disabled for own account | `client/src/lab-03/UserManagement.test.tsx` | |
| UI-19 | UI | AC-11 | User Management — duplicate email error | Inline validation error shown | `client/src/lab-03/UserManagement.test.tsx` | |

### Security / Authorization Tests

| Test ID | Type | Req / AC | What It Tests | Expected Result | Test File | Final |
|---------|------|----------|---------------|-----------------|-----------|-------|
| SEC-01 | Security | BR-06 | passwordHash never returned in any API response | JSON.stringify(response) does not contain 'passwordHash' | `server/tests/lab-03/authorization.api.test.ts` | |
| SEC-02 | Security | BR-07 | JWT secret not in response | No JWT secret visible in any response body | `server/tests/lab-03/authorization.api.test.ts` | |
| SEC-03 | Security | FR-03 | All protected endpoints reject missing JWT | 401 for every protected endpoint tested without cookie | `server/tests/lab-03/authorization.api.test.ts` | |
| SEC-04 | Security | AC-04 | Internal Note content not leaked to Requester | 403 returned; no `content` field in body | `server/tests/lab-03/authorization.api.test.ts` | |

### Migration / Regression Tests

| Test ID | Type | Req / AC | What It Tests | Expected Result | Test File | Final |
|---------|------|----------|---------------|-----------------|-----------|-------|
| MIG-01 | Regression | AC-16 | Lab 2 ticket still accessible after migration | GET /api/tickets/:id returns same ticket data | `server/tests/lab-03/auth.api.test.ts` | |
| MIG-02 | Regression | BR-24 | Migrated Requester can log in with Change@123 | 200 login; mustChangePassword=true; redirected to change-password | `server/tests/lab-03/auth.api.test.ts` | |
| MIG-03 | Regression | BR-25 | DevRequester table no longer exists | Prisma schema has no DevRequester model | schema validation | |
| MIG-04 | Regression | FR-07 | Lab 2 attachment endpoints work with JWT auth | 200 download for owned attachment; 403 for cross-user | `server/tests/lab-03/auth.api.test.ts` | |

### E2E Tests (Playwright)

| Test ID | Type | Req / AC | What It Tests | Expected Result | Test File | Final |
|---------|------|----------|---------------|-----------------|-----------|-------|
| E2E-01 | E2E | AC-01 | Full login flow — Requester | Select login → form → success → My Tickets screen | `e2e/lab-03/authentication.spec.ts` | |
| E2E-02 | E2E | AC-02 | First-login mandatory password change | Login → Change Password → enter app | `e2e/lab-03/authentication.spec.ts` | |
| E2E-03 | E2E | AC-05 | Logout blocks re-access | Logout → navigate to protected route → Login screen shown | `e2e/lab-03/authentication.spec.ts` | |
| E2E-04 | E2E | AC-07, AC-08 | IT Staff Queue → claim ticket → view detail | Login as IT Staff → Queue → claim → Detail shows owner | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-05 | E2E | AC-09 | IT Staff invalid status transition | Attempt blocked transition → error shown | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-06 | E2E | AC-10 | Public Comment posted by Requester visible to IT Staff | Requester posts → IT Staff sees comment | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-07 | E2E | BR-04 | Internal Note not visible to Requester | IT Staff posts note → Requester's detail has no Internal Notes tab | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-08 | E2E | AC-11–AC-13 | Admin User Management safety rules | Duplicate email rejected; self-deactivation blocked; last-admin blocked | `e2e/lab-03/user-administration.spec.ts` | |
| E2E-09 | E2E | AC-14 | Admin sets new password → user must change | Admin sets password → user logs in → Change Password screen | `e2e/lab-03/user-administration.spec.ts` | |
| E2E-10 | E2E | AC-16 | Lab 2 ticket intact after migration | Requester logs in → My Tickets shows pre-migration ticket | `e2e/lab-03/authentication.spec.ts` | |

---

## 3. Acceptance-Criterion Traceability

| AC ID | Covered By |
|-------|-----------|
| AC-01 | API-01, UI-02, E2E-01 |
| AC-02 | API-31, UI-05, E2E-02 |
| AC-03 | API-10, API-32 |
| AC-04 | API-08, SEC-04 |
| AC-05 | API-05, E2E-03 |
| AC-06 | API-04 |
| AC-07 | API-11 to API-14, E2E-04 |
| AC-08 | API-15, E2E-04 |
| AC-09 | API-17, E2E-05 |
| AC-10 | API-19, UI-13, E2E-06 |
| AC-11 | API-23, UI-19, E2E-08 |
| AC-12 | API-24, UI-18, E2E-08 |
| AC-13 | API-25, E2E-08 |
| AC-14 | API-26, E2E-09 |
| AC-15 | API-22, UI-16 |
| AC-16 | MIG-01, MIG-02, E2E-10 |
| AC-17 | API-07 |
| AC-18 | API-09 |
| AC-19 | API-32 |
| AC-20 | API-29, UI-07 |
| AC-21 | API-30, UI-06 |

---

## 4. Responsive and Visual Checklist

*(Complete during sprint-end visual inspection)*

### Login / Change Password
- [ ] Login card centered, no horizontal scroll at 375 px
- [ ] Password show/hide icon accessible
- [ ] Error message appears below form (not top-only)
- [ ] Change Password rule checklist readable at mobile

### IT Staff Ticket Queue
- [ ] Desktop: full table with sortable columns
- [ ] Mobile: card layout; no horizontal scroll
- [ ] Priority and Status badges consistent with Lab 2

### IT Staff Ticket Detail
- [ ] Public Comments and Internal Notes visually distinct (color or label)
- [ ] Status dropdown only shows permitted transitions
- [ ] All fields readable at tablet 900 px

### Administrator User Management
- [ ] User list readable at all viewports
- [ ] Create/Edit panel usable at mobile
- [ ] Inactive badge clearly distinct from Active

### Global
- [ ] App shell shows authenticated user name + role badge
- [ ] Role-specific nav links only (no unauthorized links visible)
- [ ] Logout accessible from all screens
- [ ] Focus outlines visible for keyboard navigation

---

## 5. Test Commands

```bash
# Server unit + API + security + migration tests
cd server
npm run test -- --run

# Client UI component tests
cd client
npm run test -- --run

# Playwright E2E (requires running app)
npx playwright test e2e/lab-03/
```

---

## 6. Final Results

| Level | Total Planned | Pass | Fail | Skip |
|-------|--------------|------|------|------|
| Unit | 8 | | | |
| API | 32 | | | |
| Security | 4 | | | |
| Migration/Regression | 4 | | | |
| UI Component | 19 | | | |
| E2E | 10 | | | |
| **Total** | **77** | | | |

---

## 7. Known Limitations or Deferred Tests

| ID | Limitation | Rationale |
|----|-----------|-----------|
| DEF-01 | Token blocklist persistence across restarts | In-memory blocklist is sufficient for course; production would use Redis |
| DEF-02 | CSRF protection full test suite | httpOnly cookie + SameSite=Strict provides baseline CSRF protection; full audit deferred |
| DEF-03 | Actions Taken tests | Deferred to Lab 4 per lab sheet §4.2 |
