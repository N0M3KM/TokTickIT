# Lab 2 Test Plan and Results

## 1. Test Strategy

This plan applies Test-Driven Development (TDD) and Test Design Driven (Test DD) principles. All test scenarios are derived from the Acceptance Criteria (AC-01–AC-23) and Business Rules (BR-01–BR-28) defined in `specification.md`. Tests are written before or alongside implementation. No test may be reconstructed after the fact from whatever the coding agent generated.

### Test Levels Used
| Level | Purpose |
|-------|---------|
| **Unit** | Pure logic: Ticket Number generation, validation helpers, sanitisation |
| **API** | HTTP request/response contracts, status codes, ownership, validation |
| **UI Component** | Rendering, field states, validation messages, button behaviour, loading/error states |
| **UI Style** | CSS class assertions, badge colours, read-only vs editable field styling |
| **Responsive** | Layout at desktop (1280 px), tablet (900 px), and mobile (375 px) viewports |
| **E2E** | Full user journeys from Requester selection through ticket creation, My Tickets, and Ticket Detail |

### Tools
| Level | Tool |
|-------|------|
| Unit / API | Vitest + Supertest (server-side, TypeScript) |
| UI Component / UI Style | Vitest + React Testing Library (client-side, TypeScript) |
| Responsive / E2E | Playwright |

---

## 2. Planned Tests

### Unit Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| UNIT-01 | Unit | BR-01 | Ticket Number generator format `TKT-YYYY-NNNNNN` | Returns string matching `/^TKT-\d{4}-\d{6}$/` | `server/tests/lab-02/ticket-number.unit.test.ts` | Pass |
| UNIT-02 | Unit | BR-01 | Ticket Numbers are unique across sequential calls | No two generated numbers are identical | `server/tests/lab-02/ticket-number.unit.test.ts` | Pass |
| UNIT-03 | Unit | BR-08 | Summary trimming removes leading/trailing whitespace | `"  hello  "` → `"hello"` | `server/tests/lab-02/ticket-validation.unit.test.ts` | Pass |
| UNIT-04 | Unit | BR-08 | Summary > 200 chars fails validation | Returns validation error | `server/tests/lab-02/ticket-validation.unit.test.ts` | Pass |
| UNIT-05 | Unit | BR-09 | Description > 2000 chars fails validation | Returns validation error | `server/tests/lab-02/ticket-validation.unit.test.ts` | Pass |
| UNIT-06 | Unit | BR-15 | Allowed MIME types pass attachment validation | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` all pass | `server/tests/lab-02/attachment-validation.unit.test.ts` | Pass |
| UNIT-07 | Unit | BR-15 | Disallowed MIME type fails attachment validation | `application/exe` returns error | `server/tests/lab-02/attachment-validation.unit.test.ts` | Pass |
| UNIT-08 | Unit | BR-16 | File size > 5 MB fails validation | Returns size error | `server/tests/lab-02/attachment-validation.unit.test.ts` | Pass |
| UNIT-09 | Unit | BR-16 | File size exactly 5 MB passes validation | No error | `server/tests/lab-02/attachment-validation.unit.test.ts` | Pass |
| UNIT-10 | Unit | BR-21 | Filename sanitiser replaces unsafe characters | `"../../evil.pdf"` → safe UUID-based filename | `server/tests/lab-02/attachment-validation.unit.test.ts` | Pass |

---

### API Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| API-01 | API | AC-01, FR-06 | POST `/api/tickets` with valid data | 201; body contains `ticketNumber` matching `TKT-YYYY-NNNNNN` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-02 | API | BR-02 | POST `/api/tickets` — `currentStatus` on created ticket | Response contains `currentStatus: "NEW"` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | API | BR-13 | POST `/api/tickets` — `ticketDate` is set by server | Response contains `ticketDate`; value is recent timestamp | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-04 | API | BR-08, AC-04 | POST `/api/tickets` with empty Summary | 400; body contains field error for `summary` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-05 | API | BR-08 | POST `/api/tickets` with Summary > 200 chars | 400; validation error | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-06 | API | BR-09 | POST `/api/tickets` with empty Description | 400; validation error for `description` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-07 | API | BR-11 | POST `/api/tickets` with invalid Priority value | 400; validation error for `requestedPriority` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-08 | API | BR-12 | POST `/api/tickets` with non-existent categoryId | 400 or 404; error references category | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-09 | API | BR-25, AC-17 | POST `/api/tickets` — server error returns safe response | 500; body is `{ "error": { "code": "...", "message": "..." } }`; no stack trace | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-10 | API | FR-07, AC-05 | GET `/api/tickets?requesterId=1` | 200; only tickets owned by requester 1 are returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-11 | API | AC-03, BR-07 | GET `/api/tickets/:id` where ticket belongs to different requester | 403 Forbidden | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-12 | API | FR-08, AC-12 | GET `/api/tickets?requesterId=1&search=laptop` | 200; results contain only tickets matching "laptop" in number or summary | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-13 | API | FR-09, AC-13 | GET `/api/tickets?requesterId=1&category=Hardware` | 200; results contain only Hardware tickets | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-14 | API | FR-09 | GET `/api/tickets?requesterId=1&priority=HIGH` | 200; results contain only HIGH priority tickets | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-15 | API | FR-11, BR-24, AC-15 | GET `/api/tickets?requesterId=1&page=2&pageSize=10` | 200; returns page 2; response includes `pagination.total`, `pagination.page`, `pagination.pageSize`, `pagination.totalPages` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-16 | API | BR-24 | GET `/api/tickets?requesterId=1&page=-1` | 200; clamped to page 1 | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-17 | API | AC-14, BR-23 | GET `/api/tickets?requesterId=1&search=zzznomatch` | 200; `data: []`; `pagination.total: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-18 | API | FR-10 | GET `/api/tickets?requesterId=1&sort=createdAt&order=asc` | 200; tickets sorted ascending by createdAt | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-19 | API | FR-14, AC-08 (count limit) | POST `/api/tickets/:id/attachments` — valid PDF under 5 MB | 201; attachment metadata returned | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-20 | API | BR-15, AC-07 | POST `/api/tickets/:id/attachments` — disallowed MIME type | 400; error indicates unsupported file type | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-21 | API | BR-16, AC-06 | POST `/api/tickets/:id/attachments` — file > 5 MB | 400; error indicates size limit exceeded | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-22 | API | BR-17, AC-08 | POST `/api/tickets/:id/attachments` — 6th active attachment | 409 Conflict; error indicates attachment limit reached | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-23 | API | BR-07 | POST `/api/tickets/:id/attachments` — ticket belongs to different requester | 403 Forbidden | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-24 | API | AC-09, FR-17 | GET `/api/tickets/:id/attachments/:attachmentId/download` — active attachment | 200; file bytes returned with correct Content-Type | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-25 | API | AC-11, BR-19 | GET `/api/tickets/:id/attachments/:attachmentId/download` — soft-removed attachment | 410 Gone | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-26 | API | AC-10, FR-15 | DELETE `/api/tickets/:id/attachments/:attachmentId` with valid reason | 200; `removedAt` and `removalReason` set; file no longer downloadable | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-27 | API | BR-18 | DELETE `/api/tickets/:id/attachments/:attachmentId` without reason | 400; validation error for `removalReason` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-28 | API | BR-28 | DELETE — attachment belongs to different requester's ticket | 403 Forbidden | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-29 | API | FR-01, BR-04 | GET `/api/requesters` | 200; only active requesters returned | `server/tests/lab-02/requesters.api.test.ts` | Pass |
| API-30 | API | BR-05 | GET `/api/requesters` — inactive requester not in response | 200; inactive requester is absent from list | `server/tests/lab-02/requesters.api.test.ts` | Pass |
| API-31 | API | FR-13 | GET `/api/tickets/:id` — owned ticket | 200; response includes ticket fields and `attachments` array | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-32 | API | FR-13 | GET `/api/tickets/:id` — attachment list includes soft-removed entries | 200; removed attachment present with `removedAt` set, `removalReason` present | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |

---

### UI Component Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| UI-01 | UI | AC-02, FR-04 | RequesterSelector rendered when no requester in localStorage | Selector screen is shown, not My Tickets | `client/src/lab-02/RequesterSelector.test.tsx` | Pass |
| UI-02 | UI | FR-01, BR-04 | RequesterSelector dropdown loads active requesters | Dropdown options match mocked active requester list | `client/src/lab-02/RequesterSelector.test.tsx` | Pass |
| UI-03 | UI | AC-20, FR-20 | RequesterSelector API failure | Error message shown; retry button present | `client/src/lab-02/RequesterSelector.test.tsx` | Pass |
| UI-04 | UI | BR-05 | RequesterSelector — no active requesters | Empty state message shown; Continue button disabled | `client/src/lab-02/RequesterSelector.test.tsx` | Pass |
| UI-05 | UI | FR-02, FR-03 | After requester selection, shell shows requester name and Change Requester button | Requester name visible in header; Change button present | `client/src/lab-02/AppShell.test.tsx` | Pass |
| UI-06 | UI | FR-03, BR-06 | Click Change Requester clears selection and shows selector | localStorage `devRequesterId` is cleared; selector rendered | `client/src/lab-02/AppShell.test.tsx` | Pass |
| UI-07 | UI | AC-04, FR-18 | CreateTicket — submit without Summary | Field-level error appears under Summary input; API not called | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-08 | UI | AC-23 | CreateTicket — submit with all required fields empty | Each required field shows its own validation error | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-09 | UI | BR-25 | CreateTicket — Submit button disabled while submitting | Button has `disabled` attribute during in-flight request | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-10 | UI | AC-01, FR-06 | CreateTicket — successful submission shows Ticket Number | Success state displays `ticketNumber` from API response | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-11 | UI | AC-17, BR-26 | CreateTicket — API failure preserves form values | Form data unchanged after API error; error message shown | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-12 | UI | AC-06 | CreateTicket — attachment > 5 MB selected | Client-side error shown; attachment not added to upload list | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-13 | UI | AC-07 | CreateTicket — disallowed file type selected | Client-side error shown; attachment not added | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-14 | UI | AC-21, BR-20 | CreateTicket — ticket created but attachment upload fails | UI informs user ticket was saved; attachment failed; link to Ticket Detail shown | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| UI-15 | UI | FR-07, AC-05 | MyTickets — displays list for selected requester | Ticket rows rendered; ticket numbers match mocked data | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-16 | UI | FR-20 | MyTickets — loading state | Skeleton or spinner shown while data is fetching | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-17 | UI | FR-20, AC-14 | MyTickets — empty state (no tickets) | "No tickets found" message shown | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-18 | UI | AC-14 | MyTickets — no-results state (search active, no matches) | "No tickets match your search" message shown; Clear Filters button visible | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-19 | UI | FR-20 | MyTickets — API failure state | Error message shown; retry mechanism available | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-20 | UI | FR-08, AC-12 | MyTickets — search input triggers filtered results | Typing in search calls API with `search` param; results update | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-21 | UI | FR-09, AC-13 | MyTickets — category filter changes results | Selecting "Hardware" calls API with `category=Hardware` | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-22 | UI | FR-11, AC-15 | MyTickets — pagination controls navigate pages | Clicking page 2 calls API with `page=2` | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-23 | UI | FR-12 | MyTickets — clicking a ticket row navigates to Ticket Detail | Router navigates to `/tickets/:id` | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| UI-24 | UI | FR-13 | RequesterTicketDetail — displays read-only ticket fields | All ticket fields rendered; no editable inputs | `client/src/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| UI-25 | UI | FR-17, AC-09 | AttachmentSection — active attachment shows Download button | Download link rendered for active attachments | `client/src/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-26 | UI | AC-10, FR-16 | AttachmentSection — removed attachment shows "Removed" badge; no download | Download button absent; "Removed" badge visible; reason displayed | `client/src/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-27 | UI | FR-15, BR-18 | AttachmentSection — soft remove dialog requires reason | Confirm button disabled until reason is entered | `client/src/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-28 | UI | BR-17, AC-08 | AttachmentSection — Add Attachment button disabled when 5 active attachments exist | Button disabled or hidden; tooltip/message shown | `client/src/lab-02/AttachmentSection.test.tsx` | Pass |

---

### UI Style Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| STYLE-01 | UI Style | Section 7 (spec) | Primary green `#006B3C` applied to app header | Header element has correct background-color | `client/src/lab-02/theme.style.test.tsx` | Pass |
| STYLE-02 | UI Style | Section 7 (spec) | Required field shows red asterisk | `*` marker rendered adjacent to required field label | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| STYLE-03 | UI Style | Section 7 (spec) | Read-only fields visually distinct from editable fields | Read-only inputs have class or style indicating non-editable state | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| STYLE-04 | UI Style | Section 7 (spec) | Validation error is dark red, appears below associated field | Error element rendered below input; colour token correct | `client/src/lab-02/CreateTicket.test.tsx` | Pass |
| STYLE-05 | UI Style | Section 7 (spec) | Priority badge colours are consistent | LOW/MEDIUM/HIGH/CRITICAL each render with expected CSS class | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| STYLE-06 | UI Style | Section 7 (spec) | Status badge "NEW" renders correctly | Badge rendered with expected class | `client/src/lab-02/MyTickets.test.tsx` | Pass |
| STYLE-07 | UI Style | Section 7 (spec) | Removed attachment badge is visually distinct | "Removed" badge has warning/red class | `client/src/lab-02/AttachmentSection.test.tsx` | Pass |

---

### Responsive Tests (Playwright)

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| RESP-01 | Responsive | AC-18 | CreateTicket at mobile 375×812 | No horizontal overflow; all fields visible; buttons touch-friendly | `e2e/lab-02/responsive.spec.ts` | Pass |
| RESP-02 | Responsive | AC-22 | TicketDetail at tablet 900×1024 | Two-column layout; all content readable; no clipping | `e2e/lab-02/responsive.spec.ts` | Pass |
| RESP-03 | Responsive | Section 8.7 (spec) | MyTickets at desktop 1280×800 | Table layout; all columns visible; pagination at bottom | `e2e/lab-02/responsive.spec.ts` | Pass |
| RESP-04 | Responsive | Section 8.7 (spec) | MyTickets at mobile 375×812 | Card/stacked layout; no horizontal scroll; pagination usable | `e2e/lab-02/responsive.spec.ts` | Pass |
| RESP-05 | Responsive | Section 8.7 (spec) | RequesterSelector at mobile 375×812 | Form centred; dropdown and Continue button accessible | `e2e/lab-02/responsive.spec.ts` | Pass |
| RESP-06 | Responsive | Section 8.7 (spec) | Navigation bar at mobile 375×812 | Hamburger menu or collapsed nav; no overlapping elements | `e2e/lab-02/responsive.spec.ts` | Pass |

---

### End-to-End Tests (Playwright)

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| E2E-01 | E2E | AC-01, AC-05 | Complete ticket creation flow: select requester → fill form → submit → see Ticket Number → find ticket in My Tickets | Confirmation with Ticket Number; ticket visible in list | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-02, FR-04 | Navigate to My Tickets with no requester selected | Redirected to Requester Selection screen | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-03 | E2E | AC-03, BR-07 | Directly access ticket URL belonging to different requester | 403 shown; ticket data not visible | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-04 | E2E | AC-16, BR-06 | Switch requester: verify Requester A tickets disappear; Requester B tickets appear | List reloads with correct data for Requester B | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-05 | E2E | AC-09, AC-10 | Upload attachment → download it → soft-remove with reason → verify download blocked | Download works before removal; 410/blocked after | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-06 | E2E | AC-08, BR-17 | Upload 5 attachments → attempt 6th | 6th upload rejected; error message shown | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-07 | E2E | AC-12, AC-14 | Search My Tickets → find match → clear search → see full list | Filtered results correct; empty-search restores full list | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-08 | E2E | AC-23 | Submit Create Ticket form with all required fields empty | All required field errors appear simultaneously | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-09 | E2E | AC-21, BR-20 | Create ticket successfully; attachment upload fails | Ticket created message shown; attachment error shown; Ticket Detail link works | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-10 | E2E | AC-15, FR-11 | Paginate through My Tickets | Page 2 shows different tickets; page count is correct | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |

---

## 3. Acceptance-Criterion Traceability

| AC ID | Criterion Summary | Covered By |
|-------|-------------------|------------|
| AC-01 | Valid submission → Ticket saved + Ticket Number displayed | API-01, API-02, API-03, UI-10, E2E-01 |
| AC-02 | No requester selected → Selector shown | UI-01, E2E-02 |
| AC-03 | Cross-requester ticket access → 403 | API-11, E2E-03 |
| AC-04 | Empty Summary → field-level error | API-04, UI-07 |
| AC-05 | Ticket visible in My Tickets after creation | API-10, UI-15, E2E-01 |
| AC-06 | File > 5 MB → client error | UI-12, API-21 |
| AC-07 | Disallowed type → client error | UI-13, API-20 |
| AC-08 | 6th active attachment → 409 / blocked | API-22, UI-28, E2E-06 |
| AC-09 | Active attachment downloadable | API-24, UI-25, E2E-05 |
| AC-10 | Soft-removed → metadata visible; download blocked | API-26, UI-26, E2E-05 |
| AC-11 | Removed attachment download URL → 410 | API-25 |
| AC-12 | Search filters by Ticket Number / Summary | API-12, UI-20, E2E-07 |
| AC-13 | Category filter works | API-13, UI-21 |
| AC-14 | No results → empty-results state shown | API-17, UI-18, E2E-07 |
| AC-15 | Pagination page 2 works | API-15, UI-22, E2E-10 |
| AC-16 | Requester switch reloads correct tickets | UI-06, E2E-04 |
| AC-17 | Backend unreachable → safe error + form preserved | UI-11 |
| AC-18 | Create Ticket usable at mobile viewport | RESP-01, E2E-01 (mobile) |
| AC-19 | Only active requesters in dropdown | UI-02, API-29, API-30 |
| AC-20 | Requester API failure → safe error + retry | UI-03 |
| AC-21 | Ticket saved but attachment fails → user informed | UI-14, E2E-09 |
| AC-22 | Ticket Detail at tablet → two-column, readable | RESP-02 |
| AC-23 | All required fields empty → all field errors at once | UI-08, E2E-08 |

---

## 4. Responsive and Visual Checklist

To be completed during visual inspection at the end of the sprint. Capture screenshots to `artifacts/lab-02/screenshots/`.

### Create Ticket
- [ ] All fields visible at desktop (1280 px); no overflow
- [ ] Two-column layout at tablet (900 px); Summary/Description full width
- [ ] Single-column at mobile (375 px); no horizontal scroll
- [ ] Required asterisks visible on all required fields
- [ ] Validation errors appear below their respective fields (not only at top)
- [ ] Read-only fields (Ticket No., Date, Requester) visually distinct from editable fields
- [ ] Submit button shows spinner/busy state during submission
- [ ] Success state clearly shows Ticket Number
- [ ] Error state shows message without exposing stack traces

### My Tickets
- [ ] Table layout at desktop; all columns legible
- [ ] Card or responsive-table layout at mobile
- [ ] Search bar, filters, sort, and Clear Filters button all visible and usable at all viewports
- [ ] Pagination controls usable at mobile
- [ ] Priority badges consistent: LOW / MEDIUM / HIGH / CRITICAL have distinct styles
- [ ] Status badge "NEW" renders correctly
- [ ] Empty-list state and no-results state are visually distinct from each other and from error

### Ticket Detail
- [ ] All ticket fields displayed in read-only style
- [ ] Attachments section clearly separated from ticket fields
- [ ] Active attachment: filename, size, type, date, Download button visible
- [ ] Removed attachment: "Removed" badge, reason shown, no Download button
- [ ] Add Attachment button disabled or hidden when 5 active attachments exist
- [ ] Soft-remove dialog requires reason; Confirm disabled until reason entered
- [ ] Breadcrumb and Back button present

### Global
- [ ] Primary green `#006B3C` used for app header and primary action buttons
- [ ] Pale green `#EAF6EF` used for success confirmations and subtle highlights
- [ ] Page background is `#F5F7F6` (near-white)
- [ ] No clipped labels, overlapping elements, or hidden buttons at any viewport
- [ ] Focus outlines visible for keyboard navigation
- [ ] Requester name and Change Requester action visible in shell after selection

---

## 5. Test Commands

```bash
# Server unit and API tests
cd server
npm run test -- --run

# Client UI component and style tests
cd client
npm run test -- --run

# Playwright E2E and responsive tests (app must be running)
npx playwright test e2e/lab-02/

# Run all Playwright tests with screenshots
npx playwright test e2e/lab-02/ --reporter=html
```

> Note: E2E tests require the full application stack (frontend + backend + database) to be running locally. Ensure the `.env` is configured and `npm run seed` has been executed before running E2E tests.

---

## 6. Final Results

> To be completed after implementation. Update the **Final** column in each test table above with `Pass`, `Fail`, or `Skip` and record the date tested.

| Level | Total Planned | Pass | Fail | Skip |
|-------|--------------|------|------|------|
| Unit | 10 | 10 | 0 | 0 |
| API | 32 | 32 | 0 | 0 |
| UI Component | 28 | 28 | 0 | 0 |
| UI Style | 7 | 7 | 0 | 0 |
| Responsive | 6 | 6 | 0 | 0 |
| E2E | 10 | 10 | 0 | 0 |
| **Total** | **93** | **93** | **0** | **0** |

---

## 7. Known Limitations or Deferred Tests

| ID | Limitation | Rationale |
|----|-----------|-----------|
| DEF-01 | File download byte-level verification in E2E | Playwright can assert file download triggers; byte content verification deferred to API-24. |
| DEF-02 | Concurrent duplicate-submission race condition | Covered by BR-25 (UI disable) and API-level uniqueness; race condition testing deferred to a future sprint. |
| DEF-03 | Accessibility (WCAG) automated audit | Full WCAG compliance requires manual assistive technology testing beyond automated tooling; deferred but keyboard focus and ARIA labels are tested in component tests. |
