# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal

Deliver a Requester-facing IT support ticketing experience that allows a selected Development Requester to create tickets, upload attachments, view their own ticket list with search/filter/sort/pagination, open a Ticket Detail screen, and manage permitted attachments — all backed by a PostgreSQL database and a validated REST API, using a consistent Zen Green UI theme that subsequent labs can reuse.

---

## 2. Stakeholder Request Interpretation

The IT department needs a working ticket submission and tracking interface for end users (Requesters). A Requester must be able to describe a problem, categorise it, set a requested priority, attach supporting files, and submit. After submission they must be able to find the ticket in a personal list, search and filter it, open its detail, and manage attachments. Because real login is not available yet, a temporary Development Requester selector acts as the "logged-in user" for testing. The system must generate an official Ticket Number, store everything safely, and strictly prevent cross-requester data access.

---

## 3. Scope

### Included
- Development Requester Selection screen (temporary testing mechanism, not authentication)
- Create Ticket screen with all required fields, validation, and attachment upload
- My Tickets screen with search, filter (category, requested priority, current status), sort, and pagination
- Requester Ticket Detail screen (read-only ticket fields + attachment management)
- Attachment lifecycle: upload, download, soft removal with reason, blocked download of removed files
- Ticket Number generation (backend, unique, formatted)
- Ownership enforcement: a Requester may only access their own tickets and attachments
- Zen Green UI theme and reusable component conventions
- PostgreSQL schema increment (Requester, Ticket, Attachment, Category, RelatedSystem)
- Idempotent seed data (4 categories, ≥6 related systems, ≥4 active requesters, 1 inactive)
- Full REST API contract for all above capabilities

### Excluded
- Authentication, login, logout, passwords, sessions, tokens, roles
- IT Staff dashboard, queue, claiming/reassigning tickets, IT Priority changes
- Public Comments, Internal Notes, Actions Taken
- Ticket status changes beyond initial **New** (no resolving, closing, reopening, cancelling)
- Administrator user/role management
- Lab 3 features

---

## 4. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | The system shall provide a Development Requester Selection screen that lists only active Requesters loaded from the database. |
| FR-02 | The selected Requester identity shall persist in the client session (localStorage) and be displayed in the application shell throughout the session. |
| FR-03 | A Change Requester action shall be available in the application shell at all times; clicking it returns the user to the Requester Selection screen and clears requester-specific data. |
| FR-04 | Attempting to navigate to My Tickets, Create Ticket, or Ticket Detail without a selected Requester shall redirect to the Requester Selection screen. |
| FR-05 | The Create Ticket screen shall capture: Category (required), Related System (optional free-text or select), Ticket Summary (required), Requested Priority (required), Description (required), and Attachments (optional at creation). |
| FR-06 | On successful ticket submission the backend shall generate and return the official Ticket Number; the UI shall display it as a success confirmation. |
| FR-07 | The My Tickets screen shall display only tickets owned by the currently selected Requester. |
| FR-08 | My Tickets shall support free-text search across Ticket Number and Summary. |
| FR-09 | My Tickets shall support filter by Category, Requested Priority, and Current Status. |
| FR-10 | My Tickets shall support sort by Ticket Number, Created Date, and Last Updated; default sort is Created Date descending. |
| FR-11 | My Tickets shall be paginated; default page size is 10; permitted sizes are 10, 25, 50. |
| FR-12 | Clicking a ticket row in My Tickets shall navigate to the Requester Ticket Detail screen for that ticket. |
| FR-13 | The Requester Ticket Detail screen shall display all ticket fields as read-only and list all attachments (including soft-removed ones as metadata). |
| FR-14 | A Requester may add an attachment to an existing ticket from the Ticket Detail screen, subject to type, size, and count limits. |
| FR-15 | A Requester may soft-remove one of their own active attachments; a removal reason is required. |
| FR-16 | Soft-removed attachments shall remain visible as metadata but their download/preview shall be blocked. |
| FR-17 | Active attachments shall be downloadable/previewable from the Ticket Detail screen. |
| FR-18 | The frontend and backend shall both validate all inputs; the backend is the authoritative validator. |
| FR-19 | All API errors shall return safe, structured error responses (no stack traces to the client). |
| FR-20 | The UI shall handle loading, empty, no-results, and failure states for every screen. |

---

## 5. Business Rules

| ID | Rule |
|----|------|
| BR-01 | The official Ticket Number is generated by the backend and must be globally unique. Format: `TKT-YYYY-NNNNNN` (e.g. `TKT-2026-000001`), where YYYY is the creation year and NNNNNN is a zero-padded sequential number scoped to the year. |
| BR-02 | A new Ticket begins with `currentStatus = NEW`. No other status is settable in Lab 2. |
| BR-03 | Lab 2 uses a Development Requester selector instead of login. The selected identity is for testing only and is not authentication. |
| BR-04 | Only active Requesters (`isActive = true`) appear in the Development Requester selector. |
| BR-05 | An inactive Requester must not be selectable and must not appear in the dropdown. |
| BR-06 | When a Requester is switched, all requester-scoped data (ticket list, ticket detail) is cleared and reloaded for the new Requester. |
| BR-07 | A Requester may only view, modify, or access tickets and attachments they own. Any attempt to access another Requester's ticket or attachment returns 403 Forbidden. |
| BR-08 | Ticket Summary is required; max 200 characters; trimmed before save. |
| BR-09 | Description is required; max 2000 characters; trimmed before save. |
| BR-10 | Related System is optional free text or selected value; max 100 characters if typed. |
| BR-11 | Requested Priority must be one of: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Default: `MEDIUM`. |
| BR-12 | Category must reference an active Category from the database; it is required. |
| BR-13 | Ticket Date is set to the server timestamp at creation; it is read-only and not supplied by the client. |
| BR-14 | The Requester field on a ticket is set from the selected Development Requester at submission time; it is not editable by the client. |
| BR-15 | Attachment allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. |
| BR-16 | Maximum attachment file size: 5 MB per file. |
| BR-17 | Maximum active (non-removed) attachments per ticket: 5. Uploading a 6th active attachment is rejected with 409 Conflict. |
| BR-18 | Attachment removal is soft: the record is retained with `removedAt` timestamp and `removalReason` (required, max 500 characters). |
| BR-19 | A soft-removed attachment's file download endpoint returns 410 Gone. |
| BR-20 | When a ticket is successfully created but a subsequent attachment upload fails, the ticket is retained and the UI informs the user that the ticket was created but the attachment was not saved; the user may retry the upload from Ticket Detail. |
| BR-21 | Original filenames are sanitised before storage; a UUID-based storage filename is used internally; the original filename is stored as metadata. |
| BR-22 | Search is case-insensitive and matches partial strings. |
| BR-23 | If no search/filter matches exist, the system returns an empty results state (not an error). |
| BR-24 | Pagination defaults: page=1, pageSize=10. Invalid page or pageSize values are clamped to valid defaults rather than returning an error. |
| BR-25 | The frontend must disable the Submit button and show a busy/loading indicator while a ticket creation or attachment request is in progress, preventing duplicate submissions. |
| BR-26 | If ticket creation fails (network or server error), all entered form data is retained so the Requester can retry without re-entering it. |
| BR-27 | In Lab 3, the `DevRequester` model will be replaced by a proper `User` model with authentication; the `requesterId` foreign key on `Ticket` must be designed to migrate cleanly (same column, different referenced table). |
| BR-28 | Only the owning Requester may remove an attachment from their own ticket. |

---

## 6. UI Specification Summary

Full detail is in `docs/lab-02/ui-spec.md`. Summary:

### Application Shell
- Top navigation bar with TokTickIT logo/name, My Tickets link, Create Ticket link, and Requester identity display with Change Requester action.
- Active page is visually highlighted.
- Responsive: collapses to a hamburger menu below 768 px.

### Development Requester Selection Screen
- Route: `/` (or `/select-requester`)
- Elements: TokTickIT title, explanation text ("This is not a login screen"), Development Requester dropdown (active only), Continue button, loading/empty/failure states.
- Keyboard accessible.

### Create Ticket Screen
- Route: `/tickets/new`
- System-generated fields (Ticket Number, Ticket Date, Requester) shown read-only at top.
- Classification fields grouped: Category (dropdown), Related System (dropdown or text), Requested Priority (dropdown).
- Summary (text input, full width), Description (textarea, resizable, full width).
- Attachments section below main fields: drag-and-drop or browse, list of staged files with remove option.
- Submit and Cancel actions at bottom.
- All validation states, success confirmation, and API failure state handled.

### My Tickets Screen
- Route: `/tickets`
- Header with page title, Create Ticket button.
- Search bar, filters (Category, Requested Priority, Current Status), Clear Filters button.
- Sortable table (desktop) / card list (mobile): Ticket No., Date, Summary, Category, Req. Priority, Current Status, Last Updated.
- Pagination controls at bottom.
- Loading, empty (no tickets), no-results (filters active), and failure states.

### Requester Ticket Detail Screen
- Route: `/tickets/:id`
- Breadcrumb: My Tickets > Ticket Details, Back button.
- All ticket fields displayed read-only.
- Attachments section: list of all attachments with name, size, type, upload date; active ones have Download button; removed ones show "Removed" badge and reason, no download.
- Add Attachment button (opens file picker, subject to BR-15 to BR-17).
- Remove button per active attachment (opens confirmation dialog requiring reason).

### Zen Green Color Tokens
| Token | Value | Use |
|-------|-------|-----|
| Primary green | `#006B3C` | App header, primary buttons, strong emphasis |
| Secondary green | `#0B7A46` | Active tabs, focus accents, links, hover |
| Pale green | `#EAF6EF` | Selected, success, subtle section emphasis |
| Page background | `#F5F7F6` | Page background |
| Surface | `#FFFFFF` | Cards, panels (subtle border + shadow) |
| Text | `#1A2E22` | Body text (dark charcoal-green) |
| Editable field | `#FFFFFF` bg + neutral border | Input, select, textarea |
| Read-only field | `#F0F4F1` bg | Ticket Number, Date, Requester display |
| Error | `#B91C1C` text + border | Field errors below the control |
| Warning | `#D97706` | Amber badge/callout |
| Success | `#166534` on `#EAF6EF` | Confirmation messages |

### Responsive Rules
| Viewport | Behavior |
|----------|----------|
| ≥ 992 px | Multi-column layout; max-width ~1200 px centered |
| 768–991 px | Two-column where practical; full-width Summary/Description |
| < 768 px | Single column; stacked fields; touch-friendly buttons; no horizontal scroll |

---

## 7. Data Changes

### New Models

#### `DevRequester`
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | Int | PK, autoincrement |
| `name` | String | required, max 100 |
| `email` | String | required, unique, max 255 |
| `isActive` | Boolean | default true, index |
| `createdAt` | DateTime | default now() |
| `updatedAt` | DateTime | updatedAt |

**Design decision:** Using a separate `DevRequester` model (not a generic `User`) isolates the Lab 2 testing mechanism. In Lab 3 a real `User` model is introduced; the FK on `Ticket` is renamed from `requesterId`→`userId` in a single migration with no data loss.

#### `Ticket`
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | Int | PK, autoincrement |
| `ticketNumber` | String | unique, index |
| `requesterId` | Int | FK → DevRequester.id, index |
| `categoryId` | Int | FK → Category.id |
| `relatedSystem` | String? | nullable, max 100 |
| `summary` | String | max 200 |
| `description` | String | max 2000 |
| `requestedPriority` | Enum `Priority` | LOW/MEDIUM/HIGH/CRITICAL, default MEDIUM |
| `currentStatus` | Enum `TicketStatus` | NEW (only value in Lab 2), default NEW |
| `ticketDate` | DateTime | default now() |
| `createdAt` | DateTime | default now() |
| `updatedAt` | DateTime | updatedAt |

Indexes: `requesterId`, `ticketNumber`, `currentStatus`, `requestedPriority`, `categoryId`, `createdAt`.

#### `Attachment`
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | Int | PK, autoincrement |
| `ticketId` | Int | FK → Ticket.id, index |
| `originalFilename` | String | max 255 |
| `storageFilename` | String | unique (UUID-based) |
| `mimeType` | String | validated against allowed types |
| `sizeBytes` | Int | ≤ 5,242,880 |
| `uploadedAt` | DateTime | default now() |
| `removedAt` | DateTime? | nullable; set on soft removal |
| `removalReason` | String? | nullable; required when removedAt is set; max 500 |
| `createdAt` | DateTime | default now() |
| `updatedAt` | DateTime | updatedAt |

Indexes: `ticketId`, `removedAt`.

#### `Category` (existing, extended if needed)
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | Int | PK, autoincrement |
| `name` | String | unique |
| `isActive` | Boolean | default true |

#### `RelatedSystem` (new reference table)
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | Int | PK, autoincrement |
| `name` | String | unique |
| `isActive` | Boolean | default true |

### Enums
```prisma
enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TicketStatus {
  NEW
}
```

### Seed Data
- Categories: Account and Access, Hardware, Software, Network
- Related Systems (≥6): Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop
- Active DevRequesters (≥4): e.g. Somchai Jaidee, Nattaporn Srisuk, Wiroj Tanaka, Araya Phongphan
- Inactive DevRequester (1): e.g. Prayut Mahachai (`isActive = false`)

---

## 8. API Contract

Full detail in `docs/lab-02/api-spec.md`. Summary of endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/requesters` | List active Dev Requesters |
| GET | `/api/categories` | List active Categories |
| GET | `/api/related-systems` | List active Related Systems |
| POST | `/api/tickets` | Create a Ticket |
| GET | `/api/tickets?requesterId=&search=&category=&priority=&status=&sort=&order=&page=&pageSize=` | List Requester's Tickets |
| GET | `/api/tickets/:id` | Get one owned Ticket with attachments |
| POST | `/api/tickets/:id/attachments` | Upload an Attachment |
| GET | `/api/tickets/:id/attachments/:attachmentId/download` | Download active Attachment |
| DELETE | `/api/tickets/:id/attachments/:attachmentId` | Soft-remove Attachment |

All endpoints return `application/json`. Errors use `{ "error": { "code": "...", "message": "..." } }` structure.

---

## 9. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | Given valid ticket data, when the Requester submits the form, then one Ticket is saved, a unique Ticket Number in `TKT-YYYY-NNNNNN` format is returned, and it is displayed in the success confirmation. |
| AC-02 | Given no Development Requester is selected, when the user attempts to open My Tickets or Create Ticket, then the Requester Selection screen is shown. |
| AC-03 | Given Requester B is selected, when a Ticket belonging to Requester A is requested by ID, then 403 Forbidden is returned and the ticket data is not displayed. |
| AC-04 | Given the Create Ticket form is submitted with Summary empty, then a field-level validation message appears below the Summary field and the API is not called. |
| AC-05 | Given a valid ticket was created, when the Requester opens My Tickets, then the new ticket appears in the list under the same Requester. |
| AC-06 | Given an attachment exceeding 5 MB is selected, when the Requester attempts to upload it, then a clear error message is shown and the attachment is not sent to the server. |
| AC-07 | Given an attachment of a disallowed type (e.g. `.exe`) is selected, then a clear error message is shown and the attachment is not uploaded. |
| AC-08 | Given a ticket already has 5 active attachments, when the Requester attempts to add a 6th, then the upload is rejected with a 409 response and an appropriate error is shown. |
| AC-09 | Given an active attachment exists, when the Requester clicks Download, then the file is served and downloaded correctly. |
| AC-10 | Given the Requester soft-removes an attachment with a reason, then the attachment record persists with metadata visible but the download button is removed and a "Removed" badge is shown. |
| AC-11 | Given a soft-removed attachment, when a direct download URL is requested, then 410 Gone is returned. |
| AC-12 | Given the Requester is on My Tickets and types a search term, then only tickets whose Ticket Number or Summary contains the term are displayed. |
| AC-13 | Given the Requester filters by Category = "Hardware", then only Hardware tickets are shown. |
| AC-14 | Given no tickets match the current search/filter, then a "no results" empty state is shown (not an error). |
| AC-15 | Given the ticket list has more than 10 items, when the Requester navigates to page 2, then the correct second page of tickets is displayed. |
| AC-16 | Given the Requester switches from Requester A to Requester B, then the ticket list is cleared and reloaded showing only Requester B's tickets. |
| AC-17 | Given the backend is unreachable, when the Create Ticket form is submitted, then a safe error message is shown and all form values are preserved. |
| AC-18 | Given the Create Ticket screen is viewed at mobile viewport (< 768 px), then all fields are visible, no horizontal scrolling occurs, and buttons are touch-friendly. |
| AC-19 | Given the Development Requester Selection screen loads, then only active Requesters appear in the dropdown. |
| AC-20 | Given the Requester Selection API fails, then a safe error state is displayed with a retry option. |
| AC-21 | Given the ticket is successfully created but the initial attachment upload fails, then the ticket is retained, and the UI informs the user that the ticket was saved but the attachment failed, with an option to retry from Ticket Detail. |
| AC-22 | Given the Ticket Detail screen is open, when the page is viewed at tablet viewport (768–991 px), then the layout is two-column where practical and all content is readable. |
| AC-23 | Given required fields (Summary, Description, Category, Requested Priority) are all missing, when the form is submitted, then each field shows its own validation message (not a single generic error). |

---

## 10. Definition of Done

### Part 1 — Product Completion
- [ ] All Functional Requirements (FR-01 to FR-20) are implemented and verifiable.
- [ ] All Business Rules (BR-01 to BR-28) are enforced by both frontend and backend.
- [ ] All Acceptance Criteria (AC-01 to AC-23) are satisfied and linked to passing tests.
- [ ] All planned automated tests pass from documented commands on the `main` branch.
- [ ] No required test is skipped, disabled, or commented out.
- [ ] The Prisma schema matches the data model in this specification.
- [ ] Idempotent seed runs without error; seed data matches spec.
- [ ] The implemented screens conform to `ui-spec.md` (colors, layout, responsive, states).
- [ ] The implemented API conforms to `api-spec.md` (endpoints, statuses, shapes, errors).
- [ ] Ownership enforcement: cross-requester access returns 403 (tested).
- [ ] Soft removal is correctly implemented: file blocked (410), metadata retained.
- [ ] Success, failure, loading, empty, and no-results states are all implemented and visible.
- [ ] Form data is preserved on API failure (tested).
- [ ] Attachment limits (type, size, count) enforced on both client and server (tested).
- [ ] Screenshots captured for all required states at desktop, tablet, and mobile viewports.
- [ ] README setup and test instructions are current and accurate.

### Part 2 — Course Delivery
- [ ] GitHub Issues created and tracked in Kanban (Backlog → Done).
- [ ] All issues implemented on named feature branches (not directly on `main` or `lab2-staging`).
- [ ] Each feature branch merged into `lab2-staging` via peer-reviewed Pull Request.
- [ ] One release PR from `lab2-staging` to `main` after integration testing.
- [ ] `reviewer.md` completed with reviewer identity, PR links, comments, responses, approvals.
- [ ] `ai-use.md` completed with LLM used, key prompts table, and reflection.
- [ ] All required documents present in `docs/lab-02/`.
- [ ] PDF evidence submitted with Answer Part 1 through Answer Part 9.

---

## 11. Assumptions and Decisions

| # | Decision | Justification |
|---|----------|---------------|
| 1 | Related System is stored as a foreign key to a `RelatedSystem` reference table, not free text. | Ensures data consistency, allows filtering, and is normalised. A freetext fallback is not used. |
| 2 | Ticket Number format is `TKT-YYYY-NNNNNN` using a year-scoped auto-increment counter. | Human-readable, sortable, and matches the example `TKT-2025-001234` shown in Figure 1. |
| 3 | Selected Requester is stored in `localStorage` (key: `devRequesterId`). | Simple, survives page refresh; cleared on Change Requester. No cookie or server session is used, consistent with the non-authentication scope of Lab 2. |
| 4 | Attachment files are stored on the server filesystem under `uploads/` with UUID filenames. | Simple for Lab 2; can be replaced with S3/cloud storage in a later lab without changing the DB schema. |
| 5 | `relatedSystem` on Ticket is a FK to `RelatedSystem.id`; labelled `relatedSystemId` in the schema. | Consistent with FK naming conventions used for `categoryId` and `requesterId`. |
| 6 | Pagination uses 1-based page numbers (page=1 is first page). | Matches common REST conventions and is clearer for frontend display. |
| 7 | The `DevRequester` model is named distinctly from the future `User` model. | Avoids confusion in Lab 3 migration; the FK on Ticket is `requesterId` and will map to `userId` in Lab 3 via a simple rename migration. |
| 8 | Summary max length is 200 chars; Description max is 2000 chars. | Summary must be scannable in a table row; 200 chars is generous but bounded. Description needs to accommodate detailed problem statements; 2000 chars is sufficient. |
