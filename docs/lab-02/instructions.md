# Lab 2 — Agent Implementation Instructions

This file tells the AI coding agent exactly what to do for each GitHub Issue. Work **one issue at a time**. When an issue is complete, stop and wait for the human to open a PR, get it reviewed, and merge it before starting the next issue.

**Core rules for the agent:**
- Read `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` before writing any code.
- Ask about ambiguities before implementing — do not invent business rules.
- Only implement what is listed in the current issue scope. Do not touch code that belongs to a future issue.
- After implementing, run the relevant tests and confirm they pass before reporting done.
- Never claim "done" if any planned test for this issue is failing, skipped, or missing.
- Do not push directly to `main` or `lab2-staging`. All work goes on the issue's feature branch.

---

## Issue #5 — Lab 2 Specification Documents

**Branch:** `feature/5-specification-and-instruction`

**Status:** Already complete. The following files were written as part of this issue:
- `docs/lab-02/specification.md`
- `docs/lab-02/tests.md`
- `docs/lab-02/ui-spec.md`
- `docs/lab-02/api-spec.md`
- `docs/lab-02/instructions.md` (this file)

**Agent action:** Nothing to implement. Wait for PR to be merged before starting Issue #6.

---

## Issue #6 — Database Schema, Migrations, and Seed Data

**Branch:** `feature/6-lab2-database-schema`
**Depends on:** Issue #5 merged into `lab2-staging`

### What to read first
- `specification.md` — Section 7 (Data Changes): all models, fields, enums, indexes, and relationships.
- `specification.md` — Section 5 (Business Rules): BR-04, BR-05, BR-21, BR-27 for schema design decisions.

### Step-by-step instructions

**Step 1 — Update `server/prisma/schema.prisma`**

Add the following in this order:
1. `Priority` enum with values `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
2. `TicketStatus` enum with value `NEW` only.
3. `DevRequester` model with fields: `id` (PK autoincrement), `name` (String), `email` (String unique), `isActive` (Boolean default true), `createdAt` (DateTime default now), `updatedAt` (DateTime updatedAt). Add `@@index([isActive])`.
4. `RelatedSystem` model with fields: `id` (PK autoincrement), `name` (String unique), `isActive` (Boolean default true).
5. Extend existing `Category` model: add `isActive Boolean @default(true)` if not already present.
6. `Ticket` model with all fields from `specification.md` Section 7. Foreign keys: `requesterId → DevRequester`, `categoryId → Category`, `relatedSystemId → RelatedSystem` (nullable). Add indexes on `requesterId`, `ticketNumber` (unique), `currentStatus`, `requestedPriority`, `categoryId`, `createdAt`.
7. `Attachment` model with all fields from `specification.md` Section 7. Foreign key `ticketId → Ticket`. Add indexes on `ticketId` and `removedAt`.
8. Add the reverse relation fields (`tickets Ticket[]`, `attachments Attachment[]`, etc.) on the parent models.

**Step 2 — Generate and apply migration**

```bash
cd server
npx prisma migrate dev --name lab2_schema_increment
```

Verify the migration file is created under `server/prisma/migrations/`.

**Step 3 — Update `server/prisma/seed.ts`**

The seed must be idempotent (use `upsert` with the unique field as the `where` clause). Add in this order:

1. **Categories** (upsert by `name`): `Account and Access`, `Hardware`, `Software`, `Network`. Set `isActive: true`.
2. **Related Systems** (upsert by `name`): `Email`, `Campus Wi-Fi`, `VPN`, `LEB2 App`, `Grade Submission App`, `Printer`, `Corporate Laptop`. Set `isActive: true`.
3. **Active DevRequesters** (upsert by `email`, minimum 4):
   - Somchai Jaidee — somchai.j@example.com — isActive: true
   - Nattaporn Srisuk — nattaporn.s@example.com — isActive: true
   - Wiroj Tanaka — wiroj.t@example.com — isActive: true
   - Araya Phongphan — araya.p@example.com — isActive: true
4. **Inactive DevRequester** (upsert by `email`, exactly 1):
   - Prayut Mahachai — prayut.m@example.com — isActive: false

**Step 4 — Run and verify seed**

```bash
cd server
npx prisma db seed
npx prisma db seed   # run twice to confirm idempotency
```

Query the database to confirm the inactive requester exists and `isActive = false`.

**Step 5 — Verify**
- Run `npx prisma validate` — no errors.
- Run `npx prisma generate` — client generates successfully.
- Confirm the migration applies cleanly on a fresh database by running `npx prisma migrate reset --force` in a dev environment and re-seeding.

### Out of scope for this issue
- No API routes. No frontend changes. No test files yet.

---

## Issue #7 — Reference Data and Development Requester APIs

**Branch:** `feature/7-reference-data-api`
**Depends on:** Issue #6 merged into `lab2-staging`

### What to read first
- `api-spec.md` — Section 2 (Reference Data Endpoints): `GET /api/requesters`, `GET /api/categories`, `GET /api/related-systems`.
- `specification.md` — BR-04, BR-05 (only active requesters returned).
- `tests.md` — API-29, API-30, and the server-error test for requesters.

### Step-by-step instructions

**Step 1 — Create route files**

In `server/src/`, create (or extend) the Express router for reference data. Suggested files:
- `server/src/routes/requesters.ts`
- `server/src/routes/categories.ts`
- `server/src/routes/relatedSystems.ts`

Register all three routers in `server/src/app.ts` under `/api`.

**Step 2 — Implement `GET /api/requesters`**

- Query `DevRequester` where `isActive = true`.
- Sort by `name` ascending.
- Return array of `{ id, name, email }`.
- Return `[]` (empty array, status 200) when no active requesters exist.
- Wrap handler in try/catch; on error return `{ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }` with status 500. Never expose stack traces.

**Step 3 — Implement `GET /api/categories`**

- Query `Category` where `isActive = true`.
- Sort by `name` ascending.
- Return array of `{ id, name }`.
- Same try/catch error handling as above.

**Step 4 — Implement `GET /api/related-systems`**

- Query `RelatedSystem` where `isActive = true`.
- Sort by `name` ascending.
- Return array of `{ id, name }`.
- Same error handling.

**Step 5 — Write tests**

Create `server/tests/lab-02/requesters.api.test.ts`. Use Supertest. Cover:
- API-29: `GET /api/requesters` returns only active requesters (status 200, correct shape).
- API-30: The inactive requester (`prayut.m@example.com`) is absent from the response.
- Error case: mock Prisma to throw; confirm 500 with safe error envelope.

Add similar basic tests for categories and related-systems (at least: returns 200 with correct shape; returns empty array when none exist).

**Step 6 — Run tests**

```bash
cd server
npm run test -- --run
```

All new tests must pass.

### Out of scope for this issue
- No ticket or attachment endpoints. No frontend changes.

---

## Issue #8 — Ticket and Attachment APIs

**Branch:** `feature/8-ticket-attachment-api`
**Depends on:** Issue #7 merged into `lab2-staging`

### What to read first
- `api-spec.md` — Sections 3 and 4 (all ticket and attachment endpoints).
- `api-spec.md` — Section 5 (Error Code Reference), Section 7 (Ownership Enforcement), Section 8 (Pagination Design), Section 9 (Ticket List Query), Section 10 (Attachment File Handling).
- `specification.md` — BR-01 (ticket number format), BR-02 (NEW status), BR-07 (ownership), BR-08 to BR-14 (validation), BR-15 to BR-22 (attachments), BR-24 (pagination clamping), BR-25 (duplicate submission prevention via backend).
- `tests.md` — UNIT-01 to UNIT-10, API-01 to API-32.

### Step-by-step instructions

**Step 1 — Ticket Number generator utility**

Create `server/src/lib/ticketNumber.ts`. Function signature:
```typescript
generateTicketNumber(year: number, sequentialNumber: number): string
```
Returns `TKT-${year}-${String(sequentialNumber).padStart(6, '0')}`.

To get the next sequential number: count existing tickets for the current year and add 1. Wrap in a Prisma transaction to avoid race conditions.

Write unit tests in `server/tests/lab-02/ticket-number.unit.test.ts` covering UNIT-01 (format) and UNIT-02 (uniqueness across sequential calls).

**Step 2 — Validation helpers**

Create `server/src/lib/ticketValidation.ts` with functions for:
- `validateSummary(value: string)`: trims, checks 1–200 chars.
- `validateDescription(value: string)`: trims, checks 1–2000 chars.

Write unit tests in `server/tests/lab-02/ticket-validation.unit.test.ts` covering UNIT-03 to UNIT-05.

Create `server/src/lib/attachmentValidation.ts` with functions for:
- `validateMimeType(mimeType: string)`: allows `image/jpeg`, `image/png`, `image/webp`, `application/pdf` only.
- `validateFileSize(bytes: number)`: max 5,242,880 bytes.
- `sanitiseFilename(originalName: string)`: returns a UUID-based storage filename with the correct extension.

Write unit tests in `server/tests/lab-02/attachment-validation.unit.test.ts` covering UNIT-06 to UNIT-10.

**Step 3 — `POST /api/tickets`**

Create `server/src/routes/tickets.ts`. Implement:
- Validate all required fields; collect all field errors and return 400 with a `fields` map if any fail.
- Verify `requesterId` references an active `DevRequester`; return 400 if not.
- Verify `categoryId` references an active `Category`; return 400 if not.
- If `relatedSystemId` is provided, verify it exists; return 400 if not.
- Generate `ticketNumber` using the utility from Step 1.
- Set `currentStatus = NEW` and `ticketDate = new Date()` on the server; ignore any client-supplied values for these fields.
- Return 201 with the full ticket object (including `requesterName`, `categoryName`, `relatedSystemName`, `attachments: []`).
- Return 500 with safe error envelope on unexpected errors.

Write Supertest tests in `server/tests/lab-02/create-ticket.api.test.ts` covering API-01 to API-09.

**Step 4 — `GET /api/tickets` (list with search/filter/sort/pagination)**

Add to `server/src/routes/tickets.ts`:
- Require `requesterId` query param; return 400 if missing or not a valid integer.
- Filter by `requesterId` (ownership — only return this requester's tickets).
- Apply optional filters: `search` (ILIKE on ticketNumber + summary, OR logic), `categoryId`, `priority`, `status` (all combined with AND).
- Apply sort: default `createdAt desc`; supported fields `ticketNumber`, `createdAt`, `updatedAt`; unknown values fall back to default.
- Apply pagination: `page` (default 1, clamp ≥ 1), `pageSize` (default 10, valid: 10/25/50, clamp invalid to 10).
- Return `{ data: [...], pagination: { page, pageSize, total, totalPages } }`.
- Return `data: []` with `total: 0` when no results match (never 404).
- Do not include the `attachments` array in list items.

Write Supertest tests in `server/tests/lab-02/my-tickets.api.test.ts` covering API-10, API-12 to API-18.

**Step 5 — `GET /api/tickets/:id` (ticket detail)**

Add to `server/src/routes/tickets.ts`:
- Require `requesterId` query param; return 400 if invalid.
- Return 404 if ticket does not exist.
- Return 403 if `ticket.requesterId !== requesterId`.
- Return full ticket object including `attachments` array (both active and soft-removed entries).
- Include `removedAt` and `removalReason` on each attachment; never return `storageFilename`.
- Sort attachments by `uploadedAt` ascending.

Write Supertest tests in `server/tests/lab-02/ticket-detail.api.test.ts` covering API-11, API-31, API-32.

**Step 6 — Set up file storage**

Create the `server/uploads/` directory. Add `server/uploads/` to `.gitignore`. The upload directory must exist at server start; create it programmatically in `server/src/server.ts` or `app.ts` using `fs.mkdirSync(uploadsDir, { recursive: true })`.

Set up `multer` middleware in `server/src/lib/upload.ts`:
- `dest`: `uploads/` (temporary; file will be renamed to UUID-based storage filename after validation).
- `limits.fileSize`: 5,242,880 bytes.
- `fileFilter`: reject files whose detected MIME type is not in the allowed list; return a multer error with `UNSUPPORTED_FILE_TYPE`.

**Step 7 — `POST /api/tickets/:id/attachments`**

Add to `server/src/routes/attachments.ts`:
- Require `requesterId` form field; return 400 if missing.
- Return 404 if ticket does not exist.
- Return 403 if `ticket.requesterId !== requesterId`.
- Check active attachment count; return 409 `ATTACHMENT_LIMIT_REACHED` if already 5.
- Validate file presence; return 400 if no file.
- Validate MIME type; return 415 `UNSUPPORTED_FILE_TYPE` if disallowed.
- Validate file size; return 400 `FILE_TOO_LARGE` if > 5 MB.
- Generate UUID-based storage filename (preserve extension); rename the multer temp file to `uploads/<uuid>.<ext>`.
- Save attachment record in database.
- Return 201 with attachment metadata (never `storageFilename`).

**Step 8 — `GET /api/tickets/:id/attachments/:attachmentId/download`**

Add to `server/src/routes/attachments.ts`:
- Validate ownership (403/404 as above).
- Return 404 if attachment not found on this ticket.
- Return 410 `ATTACHMENT_REMOVED` if `removedAt` is set.
- Serve the file using `res.download(storagePath, originalFilename)`.
- Return 500 if the physical file is missing from disk.

**Step 9 — `DELETE /api/tickets/:id/attachments/:attachmentId`**

Add to `server/src/routes/attachments.ts`:
- Validate ownership (403/404 as above).
- Return 404 if attachment not found on this ticket.
- Return 409 `ALREADY_REMOVED` if `removedAt` is already set.
- Validate `removalReason` (required, 1–500 chars trimmed); return 400 if missing or blank.
- Set `removedAt = new Date()` and `removalReason` on the record; save.
- Return 200 with updated attachment metadata.

Write Supertest tests in `server/tests/lab-02/attachments.api.test.ts` covering API-19 to API-28.

**Step 10 — Register routes**

Register the attachment router in `server/src/app.ts` under `/api/tickets/:id/attachments`.

**Step 11 — Run all server tests**

```bash
cd server
npm run test -- --run
```

All tests (UNIT-01 to UNIT-10, API-01 to API-32) must pass with no skips.

### Out of scope for this issue
- No frontend changes.

---

## Issue #9 — Development Requester Selection Screen and Application Shell (UI)

**Branch:** `feature/9-requester-selector-ui`
**Depends on:** Issue #8 merged into `lab2-staging`

### What to read first
- `ui-spec.md` — Section 6 (Application Shell) and Section 7 (Development Requester Selection Screen).
- `specification.md` — BR-03 to BR-06 (requester selection and switching).
- `api-spec.md` — Section 2.1 (`GET /api/requesters`).
- `tests.md` — UI-01 to UI-06, STYLE-01.

### Step-by-step instructions

**Step 1 — Set up Zen Green CSS tokens**

In `client/src/`, create `styles/tokens.css` (or a Tailwind config extension). Define all color tokens from `ui-spec.md` Section 2 as CSS custom properties on `:root`. These tokens must be used throughout all Lab 2 components — no hardcoded hex values in component styles.

**Step 2 — Application shell layout**

Create `client/src/components/AppShell.tsx`:
- Top navigation bar with TokTickIT logo (left), nav links "My Tickets" and "+ Create Ticket" (center/left), and Requester identity area (right).
- If `devRequesterId` is set in `localStorage`, display the Requester's name and a "Change Requester" button in the identity area.
- If not set, display a "Select Requester" button.
- Clicking "Change Requester" clears `devRequesterId` from `localStorage` and navigates to the selector route.
- Active page is highlighted (underline or background) using `--color-secondary`.
- Header background: `--color-primary` (`#006B3C`). Text: white.
- Mobile (< 768 px): hamburger menu reveals a full-width dropdown nav.

**Step 3 — Requester context**

Create `client/src/context/RequesterContext.tsx`:
- Provides `{ selectedRequesterId, selectedRequesterName, setRequester, clearRequester }`.
- On mount, reads `devRequesterId` from `localStorage`; fetches requester name if ID is present.
- `setRequester(id, name)` writes to `localStorage` and updates context state.
- `clearRequester()` removes from `localStorage` and resets state.

**Step 4 — Route guard**

Create `client/src/components/RequireRequester.tsx`:
- A wrapper component that checks if `selectedRequesterId` is set in context.
- If not set, redirects to `/select-requester`.
- Wrap the `<Route>` elements for `/tickets` and `/tickets/*` with this guard.

**Step 5 — Requester Selection screen**

Create `client/src/pages/RequesterSelector.tsx`:
- Route: `/select-requester` (and `/` if no requester is set).
- Fetch active requesters from `GET /api/requesters` on mount.
- Show loading spinner while fetching.
- Show empty state ("No active requesters found.") if array is empty.
- Show error state with Retry button on API failure.
- Dropdown lists active requesters by name; first item auto-selected.
- Info note: "Only active development requesters are shown."
- Lab 3 notice box as described in `ui-spec.md`.
- Continue button: disabled until a requester is selected; on click, calls `setRequester(id, name)` and navigates to `/tickets`.
- Cancel button: secondary style; no-op if no prior screen.
- Styling follows `ui-spec.md` Section 7 exactly (centered card, max-width 480 px, Zen Green tokens).
- Fully keyboard accessible (`aria-label`, `aria-required`, focus management).

**Step 6 — Write tests**

`client/src/lab-02/RequesterSelector.test.tsx` covering UI-01 to UI-04:
- UI-01: renders selector when no requester in localStorage.
- UI-02: dropdown shows mocked active requesters.
- UI-03: API failure shows error message and retry button.
- UI-04: empty response shows empty state; Continue disabled.

`client/src/lab-02/AppShell.test.tsx` covering UI-05, UI-06, STYLE-01:
- UI-05: shell shows requester name and Change Requester button when requester is set.
- UI-06: clicking Change Requester clears localStorage and navigates to selector.
- STYLE-01: header element has `background-color: #006B3C`.

**Step 7 — Run tests**

```bash
cd client
npm run test -- --run
```

All new tests must pass.

### Out of scope for this issue
- No ticket list, create ticket, or ticket detail screens. No attachment UI.

---

## Issue #10 — Create Ticket, My Tickets, and Ticket Detail Screens (UI)

**Branch:** `feature/10-ticket-screens-ui`
**Depends on:** Issue #9 merged into `lab2-staging`

### What to read first
- `ui-spec.md` — Sections 8 (Create Ticket), 9 (My Tickets), 10 (Ticket Detail), 11 (Accessibility), 12 (Responsive Breakpoints).
- `specification.md` — FR-05 to FR-20, BR-08 to BR-28, AC-01, AC-03 to AC-18, AC-21 to AC-23.
- `api-spec.md` — Sections 3 and 4 (all ticket and attachment endpoints).
- `tests.md` — UI-07 to UI-28, STYLE-02 to STYLE-07.

### Step-by-step instructions

**Step 1 — Reusable components**

Before building screens, create these shared components in `client/src/components/`:
- `Badge.tsx`: accepts `variant` prop (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`/`NEW`/`Active`/`Removed`); renders with correct colors from `ui-spec.md` Section 5.5.
- `LoadingSpinner.tsx`: centered spinner with `aria-label="Loading"`.
- `EmptyState.tsx`: accepts `title`, `description`, and optional `action` (button).
- `ErrorState.tsx`: accepts `message` and optional `onRetry` callback.
- `ConfirmDialog.tsx`: modal with focus trap, `aria-modal`, Escape key handling, title, body, and confirm/cancel buttons.
- `Pagination.tsx`: accepts `page`, `pageSize`, `total`, `totalPages`, `onPageChange`, `onPageSizeChange`.

**Step 2 — Create Ticket screen**

Create `client/src/pages/CreateTicket.tsx`:
- Wrapped in `<RequireRequester>`.
- On mount: fetch categories (`GET /api/categories`) and related systems (`GET /api/related-systems`) in parallel; show loading state; show error state with retry on failure.
- Read-only fields: Ticket Number ("(auto-generated)"), Ticket Date ("(auto)"), Requester (from context — name).
- Editable fields: Category (required dropdown), Related System (optional dropdown), Requested Priority (required dropdown, default MEDIUM), Summary (required text input, max 200), Description (required textarea, min-height 120 px, vertically resizable, max 2000).
- Attachment staging section: drag-and-drop or browse button; validate MIME type and size client-side before adding to staged list; each staged file shows name, size, and remove `×` button; invalid file shows inline error.
- On submit:
  1. Run client-side validation for all required fields simultaneously; show field-level errors and stop if any fail.
  2. Set Submit button to busy/disabled.
  3. `POST /api/tickets` with form data.
  4. On 201: upload each staged attachment via `POST /api/tickets/:id/attachments` sequentially. If ticket created but any upload fails, show partial-success state (ticket saved, attachment failed, link to Ticket Detail).
  5. On 201 full success: show success panel with Ticket Number (large, primary green), "View Ticket Detail" and "Create Another Ticket" buttons.
  6. On API error: show error banner; restore all form values; re-enable Submit.
- Required fields show red asterisk. Validation messages appear directly below each field.
- Fully responsive per `ui-spec.md` Section 8.

**Step 3 — My Tickets screen**

Create `client/src/pages/MyTickets.tsx`:
- Wrapped in `<RequireRequester>`.
- On mount and on any filter/sort/page change: fetch `GET /api/tickets?requesterId=&...` with current filter state.
- Search bar: debounced 300 ms; searches on ticket number and summary.
- Filter dropdowns: Category (from API), Requested Priority, Current Status. All combined with AND.
- Clear Filters button: visible only when any filter or search is active; resets all to defaults.
- Sort: default `createdAt desc`; clicking sortable column headers toggles asc/desc.
- Pagination: page size selector (10/25/50); previous/next and numbered page buttons.
- Desktop: sortable table with columns per `ui-spec.md` Section 9. Priority and Status columns use `Badge` component.
- Mobile (< 768 px): ticket cards (Ticket No., Status badge, Summary, Category, Priority badge, date). No horizontal scroll.
- Clicking any row/card navigates to `/tickets/:id`.
- "+ Create Ticket" button in page header.
- Loading, empty (no tickets), no-results (filters active), and failure states using shared components.
- Whenever `selectedRequesterId` changes in context, clear the list and re-fetch.

**Step 4 — Ticket Detail screen**

Create `client/src/pages/TicketDetail.tsx`:
- Wrapped in `<RequireRequester>`.
- On mount: fetch `GET /api/tickets/:id?requesterId=`.
- Handle 403 (show "You do not have permission to view this ticket."), 404 (show "Ticket not found."), and generic API failure.
- All ticket fields rendered read-only using `--color-readonly-bg` background.
- Breadcrumb: "My Tickets > Ticket Details" with Back button navigating to `/tickets`.
- Attachments section (separate `AttachmentSection.tsx` component):
  - List all attachments (active and removed).
  - Active attachment row: filename, size, MIME type, upload date, Download button, Remove button.
  - Removed attachment row: filename, size, MIME type, `Removed` badge, removal reason in secondary text, no Download button, reduced opacity.
  - Download button: calls `GET /api/tickets/:id/attachments/:attachmentId/download`; triggers browser download.
  - Remove button: opens `ConfirmDialog` with required reason input (Confirm disabled until non-empty); on confirm calls `DELETE /api/tickets/:id/attachments/:attachmentId`; updates attachment list on success.
  - "+ Add Attachment" button at top of section: opens file picker; validates type and size client-side; uploads via `POST /api/tickets/:id/attachments`; shows inline progress; shows inline error on failure; disabled (with tooltip "Maximum of 5 attachments reached") when 5 active attachments exist.

**Step 5 — Write tests**

`client/src/lab-02/CreateTicket.test.tsx` covering UI-07 to UI-14, STYLE-02, STYLE-03, STYLE-04.
`client/src/lab-02/MyTickets.test.tsx` covering UI-15 to UI-23, STYLE-05, STYLE-06.
`client/src/lab-02/RequesterTicketDetail.test.tsx` covering UI-24.
`client/src/lab-02/AttachmentSection.test.tsx` covering UI-25 to UI-28, STYLE-07.

**Step 6 — Run tests**

```bash
cd client
npm run test -- --run
```

All tests UI-07 to UI-28 and STYLE-02 to STYLE-07 must pass with no skips.

### Out of scope for this issue
- No E2E tests. No Playwright. No screenshots.

---

## Issue #11 — E2E Tests, Responsive Tests, Visual Checklist, and Release

**Branch:** `feature/11-e2e-and-release`
**Depends on:** Issue #10 merged into `lab2-staging`

### What to read first
- `tests.md` — E2E-01 to E2E-10, RESP-01 to RESP-06, Section 4 (Visual Checklist), Section 5 (Test Commands).
- `ui-spec.md` — Section 13 (Visual Inspection Checklist and Screenshot Paths).
- `specification.md` — AC-01 to AC-23 (every criterion must be evidenced).

### Step-by-step instructions

**Step 1 — Set up Playwright**

If not already configured, install and initialise Playwright in the project root:

```bash
npm init playwright@latest
```

Configure `playwright.config.ts`:
- `baseURL`: `http://localhost:5173` (or the Vite dev server port).
- Viewports for tests: desktop 1280×800, tablet 900×1024, mobile 375×812.
- Screenshot on failure: `"only-on-failure"`.
- Output directory: `artifacts/lab-02/screenshots/`.
- Test directory: `e2e/`.

Create `e2e/lab-02/` directory.

**Step 2 — E2E test file**

Create `e2e/lab-02/requester-ticket-flow.spec.ts`. Implement tests E2E-01 to E2E-10:

- **E2E-01:** Select a requester → fill Create Ticket form with valid data → submit → assert success panel shows `TKT-YYYY-NNNNNN` format → navigate to My Tickets → assert ticket appears in list.
- **E2E-02:** Navigate to `/tickets` without selecting a requester → assert redirected to selector screen.
- **E2E-03:** Select Requester A → obtain a ticket ID → switch to Requester B → navigate directly to `/tickets/<requester-A-ticket-id>` → assert 403 / permission error message shown.
- **E2E-04:** Select Requester A → view My Tickets → assert tickets shown → Change Requester → select Requester B → assert Requester A's tickets are gone and Requester B's tickets are shown.
- **E2E-05:** Open Ticket Detail → upload an attachment → assert it appears with Download button → download it → soft-remove it with a reason → assert "Removed" badge appears and Download button is gone.
- **E2E-06:** Upload 5 attachments to a ticket → attempt to upload a 6th → assert error message about the limit.
- **E2E-07:** In My Tickets, type a search term that matches one ticket → assert only matching ticket shown → clear search → assert full list restored. Apply a category filter that yields no results → assert no-results empty state shown.
- **E2E-08:** On Create Ticket, click Submit with all required fields empty → assert all required field error messages appear simultaneously.
- **E2E-09:** Mock or simulate a ticket-creation success followed by an attachment-upload failure → assert UI shows ticket-created-but-attachment-failed message with a link to Ticket Detail.
- **E2E-10:** In My Tickets (with > 10 tickets seeded), navigate to page 2 → assert different tickets shown; assert pagination metadata ("Showing X–Y of Z") is correct.

**Step 3 — Responsive test file**

Create `e2e/lab-02/responsive.spec.ts`. Implement RESP-01 to RESP-06:

For each test, use `page.setViewportSize()` to set the viewport, navigate to the target screen, take a full-page screenshot, and assert:
- No horizontal overflow (`document.body.scrollWidth <= window.innerWidth`).
- No clipped or zero-size visible interactive elements (check buttons and inputs).

- **RESP-01:** Mobile 375×812 → `/tickets/new` — assert no horizontal scroll; all form fields visible; Submit button height ≥ 44 px.
- **RESP-02:** Tablet 900×1024 → `/tickets/:id` — assert two-column-ish layout; all content visible; no clipping.
- **RESP-03:** Desktop 1280×800 → `/tickets` — assert table layout; all columns visible; pagination at bottom.
- **RESP-04:** Mobile 375×812 → `/tickets` — assert card layout; no horizontal scroll; pagination usable.
- **RESP-05:** Mobile 375×812 → `/select-requester` — assert form centered; dropdown and Continue button accessible.
- **RESP-06:** Mobile 375×812 → any screen — assert nav collapses; no overlapping elements.

**Step 4 — Capture screenshots**

After all tests pass, run Playwright with screenshot capture for each key screen state at all three viewport sizes. Save to the paths defined in `ui-spec.md` Section 13 under `artifacts/lab-02/screenshots/`.

```bash
npx playwright test e2e/lab-02/ --reporter=html
```

Review the HTML report and confirm all screenshots match the `ui-spec.md` visual spec.

**Step 5 — Complete the visual checklist**

Open `tests.md` Section 4 (Responsive and Visual Checklist). Go through every item. Check each box only after visually confirming it in the screenshots. Do not check a box by assumption.

**Step 6 — Complete `docs/lab-02/reviewer.md` and `docs/lab-02/ai-use.md`**

- `reviewer.md`: fill in reviewer identity, all PR links (Issues #6–#11), comments given and received, and approval records.
- `ai-use.md`: mention the LLM used, provide a table of 6–10 key prompts used during the sprint, and write a short "My Reflection" paragraph.

**Step 7 — Final full-suite check**

Run the complete test suite from the project root:

```bash
# Server tests
cd server && npm run test -- --run

# Client tests
cd client && npm run test -- --run

# E2E
npx playwright test e2e/lab-02/
```

All 93 planned tests must be in Pass state. Zero skipped, zero disabled, zero commented out.

**Step 8 — Update README**

Ensure `README.md` at the project root has current, accurate instructions for:
- Installing dependencies
- Setting up the `.env` file
- Running database migrations and seed
- Starting the development server
- Running server tests
- Running client tests
- Running E2E tests

**Step 9 — Open release PR**

Once this feature branch passes all checks on `lab2-staging`:
- Open one release Pull Request from `lab2-staging` → `main`.
- Peer review and approval required before merge.
- Move all GitHub Issues (#5–#11) to Done on the Kanban board.

### Out of scope for this issue
- No new features. No schema changes. No new API endpoints.
