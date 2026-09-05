# Lab 2 UI Specification — TokTickIT Zen Green Theme

---

## 1. Design Principles

- **Consistency**: Every screen reuses the same tokens, components, and patterns defined here. Later labs must extend, not replace, this system.
- **Clarity**: System-generated and read-only values are always visually distinct from editable inputs.
- **Accessibility**: All controls are keyboard-navigable, ARIA-labelled, and usable without relying on color alone.
- **Responsiveness**: Every screen must be clear and usable at desktop (≥ 992 px), tablet (768–991 px), and mobile (< 768 px) without horizontal scrolling.
- **Feedback**: Every user action has a visible loading, success, or error state.

---

## 2. Color Tokens

| Token Name | Hex Value | Intended Use |
|-----------|-----------|-------------|
| `--color-primary` | `#006B3C` | App header background, primary action buttons, strong emphasis text |
| `--color-primary-hover` | `#005530` | Primary button hover state |
| `--color-secondary` | `#0B7A46` | Active nav tab underline, focus ring accent, links, hover states on secondary actions |
| `--color-pale-green` | `#EAF6EF` | Success banners, selected row highlight, subtle section backgrounds |
| `--color-page-bg` | `#F5F7F6` | Page/body background |
| `--color-surface` | `#FFFFFF` | Cards, form panels, table rows |
| `--color-border` | `#D1D9D4` | Card borders, input borders |
| `--color-shadow` | `rgba(0,0,0,0.06)` | Restrained card drop shadow |
| `--color-text-primary` | `#1A2E22` | Body text (dark charcoal-green, not pure black) |
| `--color-text-secondary` | `#4A6355` | Secondary labels, helper text, metadata |
| `--color-text-disabled` | `#9BB5A4` | Disabled control text |
| `--color-readonly-bg` | `#F0F4F1` | Read-only / system-generated field background |
| `--color-editable-bg` | `#FFFFFF` | Editable input background |
| `--color-editable-border` | `#8BA89A` | Default input border |
| `--color-focus-ring` | `#0B7A46` | Keyboard focus outline (2 px solid) |
| `--color-error` | `#B91C1C` | Error text and input border |
| `--color-error-bg` | `#FEF2F2` | Error input background (subtle) |
| `--color-warning` | `#D97706` | Warning badge / callout text |
| `--color-warning-bg` | `#FFFBEB` | Warning badge background |
| `--color-success-text` | `#166534` | Success message text |
| `--color-success-bg` | `#EAF6EF` | Success message background |
| `--color-disabled-bg` | `#E9EFEC` | Disabled button/input background |

---

## 3. Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Page title (h1) | System sans-serif | 24 px | 700 | `--color-text-primary` |
| Section heading (h2) | System sans-serif | 18 px | 600 | `--color-text-primary` |
| Sub-heading (h3) | System sans-serif | 16 px | 600 | `--color-text-primary` |
| Label | System sans-serif | 14 px | 500 | `--color-text-primary` |
| Body / input value | System sans-serif | 14 px | 400 | `--color-text-primary` |
| Helper / secondary | System sans-serif | 13 px | 400 | `--color-text-secondary` |
| Error message | System sans-serif | 13 px | 400 | `--color-error` |
| Badge text | System sans-serif | 12 px | 500 | depends on badge type |

---

## 4. Spacing

| Token | Value | Use |
|-------|-------|-----|
| `--space-xs` | 4 px | Inline gap between icon and text |
| `--space-sm` | 8 px | Tight padding inside compact elements |
| `--space-md` | 16 px | Standard field-to-field gap; card internal padding |
| `--space-lg` | 24 px | Section-to-section gap |
| `--space-xl` | 32 px | Page vertical padding |
| `--space-xxl` | 48 px | Large section separator |
| Max content width | 1200 px | Centered container on desktop |
| Border radius (input/card) | 6 px | |
| Border radius (badge/button) | 4 px | |

---

## 5. Component States

### 5.1 Input / Select / Textarea

| State | Background | Border | Text | Notes |
|-------|-----------|--------|------|-------|
| Default | `--color-editable-bg` | `--color-editable-border` (1 px) | `--color-text-primary` | |
| Focused | `--color-editable-bg` | `--color-focus-ring` (2 px solid) | `--color-text-primary` | Outline offset 2 px |
| Invalid | `--color-error-bg` | `--color-error` (1.5 px) | `--color-text-primary` | Error message below |
| Disabled | `--color-disabled-bg` | `--color-border` | `--color-text-disabled` | `cursor: not-allowed` |
| Read-only | `--color-readonly-bg` | `--color-border` (dashed optional) | `--color-text-primary` | No user interaction |

All inputs use a consistent height of **40 px**. Textarea (Description) is taller (minimum 120 px) and vertically resizable only, not horizontally.

### 5.2 Buttons

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | `--color-primary` | `#FFFFFF` | none | `--color-primary-hover` |
| Secondary | `#FFFFFF` | `--color-primary` | `--color-primary` (1 px) | `--color-pale-green` bg |
| Tertiary / Ghost | transparent | `--color-secondary` | none | underline + pale bg |
| Destructive | `#DC2626` | `#FFFFFF` | none | `#B91C1C` |
| Disabled | `--color-disabled-bg` | `--color-text-disabled` | none | none (`cursor: not-allowed`) |
| Busy/Loading | Primary bg + spinner | `#FFFFFF` (dimmed) | none | not interactive |

- Button height: **40 px** (same as inputs for visual alignment).
- All buttons include visible text. Icons may supplement but not replace text.
- Every icon-only control (if used) requires `aria-label` and `title` tooltip.
- The Submit / primary action button shows an inline spinner and is `disabled` while the request is in progress.

### 5.3 Required Field Marker

- A red asterisk (`*`) is rendered **after** the label text: `Summary *`
- CSS: `color: #B91C1C; margin-left: 2px;`
- The asterisk does **not** replace the validation error message.

### 5.4 Validation Messages

- Appear immediately **below** the associated field, not at the top of the form only.
- Shown as: `color: --color-error; font-size: 13 px; margin-top: 4 px;`
- Accompanied by `aria-describedby` linking the input to the error element.
- On submission attempt, all field errors appear simultaneously.

### 5.5 Badge Component

Used for Priority, Status, and Attachment states.

| Badge Type | Background | Text Color | Label |
|-----------|-----------|-----------|-------|
| Priority: LOW | `#DBEAFE` | `#1D4ED8` | LOW |
| Priority: MEDIUM | `#FEF3C7` | `#92400E` | MEDIUM |
| Priority: HIGH | `#FEE2E2` | `#991B1B` | HIGH |
| Priority: CRITICAL | `#F3E8FF` | `#6B21A8` | CRITICAL |
| Status: NEW | `#E0F2FE` | `#0369A1` | NEW |
| Attachment: Active | `--color-pale-green` | `--color-success-text` | Active |
| Attachment: Removed | `--color-warning-bg` | `--color-warning` | Removed |

Badge shape: `border-radius: 12 px; padding: 2 px 8 px; font-size: 12 px; font-weight: 500;`

### 5.6 Loading State

- Inline spinner (CSS or SVG, 20 px) centered within the loading area.
- For full-page data loads (My Tickets, Ticket Detail): show a skeleton card or spinner centered in the content area.
- Loading text: `"Loading…"` (screen-reader accessible via `aria-live="polite"`).

### 5.7 Empty States

- Centered icon (e.g. inbox or ticket icon, 48 px) + heading + short description.
- **Empty list** (no tickets at all): "You have no tickets yet." + "Create Ticket" button.
- **No results** (search/filter active): "No tickets match your search." + "Clear Filters" button.
- **Empty Requester list**: "No active requesters found. Please contact your administrator."

### 5.8 Error / Failure States

- Full-panel error: warning icon + brief message + optional Retry button.
- No stack traces exposed to the UI.
- `role="alert"` on the error container for screen reader announcement.

---

## 6. Application Shell

### Layout
```
┌─────────────────────────────────────────────────────┐
│  [Logo] TokTickIT   │ My Tickets  + Create Ticket   │  [👤 Requester Name ▼]  │
└─────────────────────────────────────────────────────┘
│                                                     │
│   <Page Content>                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Header Spec
- Background: `--color-primary` (`#006B3C`)
- Text / icons: `#FFFFFF`
- Height: 56 px
- Logo/name: left-aligned; clicking returns to My Tickets (or Requester Selector if not selected)
- Nav links: "My Tickets", "+ Create Ticket" — centered or left group
- Active page: underline or highlighted tab with `--color-pale-green` or white underline 2 px
- Right side: Requester identity dropdown showing selected Requester name + avatar initials; dropdown contains "Change Requester" action
- If no requester selected: show "Select Requester" button instead

### Mobile Header (< 768 px)
- Hamburger menu (☰) on the right
- Clicking hamburger reveals a full-width dropdown nav with My Tickets, Create Ticket, Change Requester
- Logo/name remains visible on left

---

## 7. Development Requester Selection Screen

**Route:** `/` or `/select-requester`  
**Purpose:** Testing mechanism — not authentication.

### Layout (centered card, max-width 480 px)
```
┌─────────────────────────────────────────────┐
│         [Icon: person-settings 48 px]       │
│                                             │
│     Select Development Requester           │
│                                             │
│  Choose a development requester to          │
│  simulate requester-specific ticket         │
│  behaviour. This is not a login screen.    │
│  Authentication will be introduced          │
│  in Lab 3.                                  │
│                                             │
│  Development Requester *                    │
│  ┌──────────────────────────────────────┐  │
│  │  Jennifer Anderson              ▼   │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ⓘ Only active requesters are shown.       │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 🔒 Authentication coming in Lab 3    │  │
│  │ This will be replaced with secure    │  │
│  │ authentication in Lab 3.             │  │
│  └──────────────────────────────────────┘  │
│                                             │
│         [Cancel]     [→ Continue]           │
└─────────────────────────────────────────────┘
```

### Required Elements
| Element | Detail |
|---------|--------|
| TokTickIT title in shell header | Always visible |
| Icon | 48 px person/settings icon in `--color-primary` |
| Screen title | "Select Development Requester" (h2) |
| Explanation text | "This is not a login screen. Authentication and role-based access will be introduced in Lab 3." |
| Dropdown | Lists only active Requesters (name + email); sorted by name |
| Info note | "Only active development requesters are shown." |
| Lab 3 notice box | Pale bordered box explaining this selector will be replaced |
| Continue button | Primary; disabled until a requester is selected |
| Cancel button | Secondary; navigates back (or no-op if no previous screen) |

### States
| State | Behaviour |
|-------|-----------|
| Loading | Spinner in place of dropdown; Continue disabled |
| Loaded | Dropdown populated; first item auto-selected |
| Empty (no active requesters) | Dropdown replaced with "No active requesters found"; Continue disabled |
| API failure | Error message with Retry button; Continue disabled |

---

## 8. Create Ticket Screen

**Route:** `/tickets/new`  
**Requires:** Requester selected (redirect to Selector if not)

### Layout (desktop ≥ 992 px — two columns)
```
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumb: Home > Create Ticket                             │
├──────────────────────────────────────────────────────────────┤
│ [Read-only row]                                              │
│  Ticket Number        Ticket Date           Requester        │
│  [ (auto-generated) ] [ (server timestamp) ] [ Somchai J.  ] │
├──────────────────────────────────────────────────────────────┤
│ [Classification row — 3 columns]                             │
│  Category *           Related System        Req. Priority *  │
│  [   dropdown   ▼]   [   dropdown   ▼]     [   dropdown  ▼]  │
├──────────────────────────────────────────────────────────────┤
│ Summary *                                                    │
│ [                                                          ] │
│                                                              │
│ Description *                                                │
│ [                                                          ] │
│ [                   (resizable textarea)                   ] │
├──────────────────────────────────────────────────────────────┤
│ Attachments                                                  │
│ ┌────────────────────────────────────────────────────────┐   │
│ │  📎 Drag and drop files here, or [Browse]              │   │
│ │  Allowed: JPG, PNG, WEBP, PDF · Max 5 MB each          │   │
│ └────────────────────────────────────────────────────────┘   │
│ [Staged file list with remove × button per file]             │
├──────────────────────────────────────────────────────────────┤
│                            [Cancel]  [Submit Ticket →]       │
└──────────────────────────────────────────────────────────────┘
```

### Tablet (768–991 px)
- Read-only row: 3 columns → 2 columns (Requester wraps below)
- Classification row: 3 columns → 2 columns (Priority wraps below)
- Summary and Description remain full width

### Mobile (< 768 px)
- All fields stack to single column
- Attachment drop zone remains full width
- Cancel and Submit stack vertically (Submit on top)

### Field Specifications

| Field | Type | Required | Read-only | Validation |
|-------|------|----------|-----------|------------|
| Ticket Number | Text display | — | Yes | System-generated; shown as "(auto)" before submission |
| Ticket Date | Text display | — | Yes | System-generated; shown as "(auto)" before submission |
| Requester | Text display | — | Yes | Set from selected Dev Requester; not editable |
| Category | Select (dropdown) | Yes | No | Must select from active categories |
| Related System | Select (dropdown) | No | No | Must select from active related systems; optional |
| Requested Priority | Select (dropdown) | Yes | No | LOW / MEDIUM / HIGH / CRITICAL; default MEDIUM |
| Summary | Text input | Yes | No | 1–200 chars; trimmed; error if empty or > 200 |
| Description | Textarea | Yes | No | 1–2000 chars; trimmed; error if empty or > 2000 |
| Attachments | File input | No | No | 0–5 files; JPG/PNG/WEBP/PDF; ≤ 5 MB each |

### Screen States

| State | Description |
|-------|-------------|
| **Initial** | Empty form; dropdowns populated from API; read-only fields show "(auto)" placeholder |
| **Loading reference data** | Dropdowns show spinner; Submit disabled |
| **Reference data failure** | Error banner at top of form; form not usable; Retry button |
| **Validation error** | Field-level messages below each invalid field; Submit enabled (user must correct) |
| **Submitting** | Submit button shows spinner + "Submitting…"; button disabled; form inputs disabled |
| **Success** | Form replaced by success panel (see below) |
| **API failure** | Error banner at top; all form values preserved; Submit re-enabled |
| **Attachment client error** | Error shown in attachment area; attachment not added; form still usable |

### Success State Panel
```
┌──────────────────────────────────────────────────────┐
│  ✅  Ticket Created Successfully                     │
│                                                      │
│  Your ticket number is:                              │
│  TKT-2026-000042                                     │
│                                                      │
│  [View Ticket Detail]   [Create Another Ticket]      │
└──────────────────────────────────────────────────────┘
```
- Ticket Number rendered in large bold text with `--color-primary`
- "View Ticket Detail" navigates to `/tickets/:id`
- "Create Another Ticket" resets the form

### Attachment Staged File Row
```
📄 report.pdf   (2.3 MB)   [×]
🖼  screenshot.png  (450 KB)   [×]
```
- `[×]` removes the file from the staged list before submission
- If a staged file is invalid (shown after client validation), it appears with a red border and error text; it cannot be submitted

---

## 9. My Tickets Screen

**Route:** `/tickets`  
**Requires:** Requester selected

### Layout (desktop ≥ 992 px)
```
┌─────────────────────────────────────────────────────────────────┐
│ My Tickets                               [↺ Clear Filters] [+ Create Ticket] │
│ View and track all of your support requests.                    │
├──────────────────────────────────────────────────────────────────┤
│ [🔍 Search by ticket number or summary…]                        │
│  Category [All ▼]  Req. Priority [All ▼]  Status [All ▼]       │
├──────────────────────────────────────────────────────────────────┤
│ Ticket No. ↕ │ Created ↕ │ Summary      │ Category │ Req.Pri │ Status │ Last Updated ↕ │
│─────────────────────────────────────────────────────────────────│
│ TKT-2026-... │ ...       │ ...          │ ...      │ MEDIUM  │ NEW    │ ...            │
│ ...                                                              │
├──────────────────────────────────────────────────────────────────┤
│  Showing 1–10 of 42 tickets   [< Prev]  [1] [2] [3] … [5]  [Next >] │
└──────────────────────────────────────────────────────────────────┘
```

### Tablet (768–991 px)
- Table remains but some lower-priority columns may be hidden (e.g. Last Updated hidden, accessible via row click)
- Search and filter row wraps to two lines if needed

### Mobile (< 768 px)
- Table replaced by **ticket cards**:
```
┌──────────────────────────────────┐
│ TKT-2026-000042          [NEW]   │
│ Laptop battery drains quickly    │
│ Hardware · MEDIUM · May 12, 2026 │
└──────────────────────────────────┘
```
- Each card is tappable and navigates to Ticket Detail
- Search bar full width above cards
- Filters accessible via a "Filters" expand/toggle button

### Columns (desktop table)

| Column | Sortable | Notes |
|--------|----------|-------|
| Ticket No. | Yes | Clickable link; green text |
| Created Date | Yes (default ↓) | Formatted: "May 12, 2026 09:14 AM" |
| Summary | No | Truncated at 60 chars with ellipsis |
| Category | No | Plain text |
| Req. Priority | No | Badge component |
| Current Status | No | Badge component |
| Last Updated | Yes | Formatted date |

### Filter Controls

| Control | Type | Options |
|---------|------|---------|
| Search | Text input | Searches Ticket Number + Summary (debounced 300 ms) |
| Category | Select | "All Categories" + dynamic list from API |
| Requested Priority | Select | All / LOW / MEDIUM / HIGH / CRITICAL |
| Current Status | Select | All / NEW |
| Clear Filters | Button (secondary) | Resets all filters and search; visible only when filters are active |

### Sort Behaviour
- Default sort: Created Date descending
- Secondary sort (tiebreaker): Ticket Number descending
- Clicking a sortable column header toggles asc/desc; active sort shown with ↑/↓ arrow

### Pagination Controls
- Format: `Showing X–Y of Z tickets`
- Page buttons: Previous, numbered pages (max 5 shown with ellipsis), Next
- Current page button: filled primary green
- Page size selector: 10 / 25 / 50 (dropdown in footer)

### Screen States

| State | Behaviour |
|-------|-----------|
| Loading | Skeleton rows or spinner in table area |
| Loaded | Ticket rows rendered |
| Empty (no tickets) | "You have no tickets yet." + Create Ticket button |
| No results (filters/search active) | "No tickets match your filters." + Clear Filters button |
| API failure | Error panel; Retry button |

---

## 10. Requester Ticket Detail Screen

**Route:** `/tickets/:id`  
**Requires:** Requester selected + ticket ownership

### Layout (desktop)
```
┌──────────────────────────────────────────────────────────────────┐
│  My Tickets > Ticket Details                [← Back to My Tickets] │
├──────────────────────────────────────────────────────────────────┤
│  Ticket No.        Ticket Date          Category    Related System │
│  TKT-2026-000042   May 12, 2026 09:14   Hardware    Corporate Laptop │
│                                                                    │
│  Requester         Requested Priority   Current Status             │
│  Somchai Jaidee    MEDIUM [badge]       NEW [badge]                │
│                                                                    │
│  Summary                                                          │
│  Laptop battery drains quickly                                    │
│                                                                    │
│  Description                                                      │
│  My laptop battery drains much faster than usual even when idle… │
├──────────────────────────────────────────────────────────────────┤
│  Attachments (2)                          [+ Add Attachment]      │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 📄 report.pdf      2.3 MB   PDF   May 12, 2026  [Download] [🗑]│ │
│ │ 🖼  screenshot.png  450 KB  PNG   May 13, 2026  [Download] [🗑]│ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### All Ticket Fields (read-only)

| Field | Display |
|-------|---------|
| Ticket Number | Bold, `--color-primary` color |
| Ticket Date | Formatted: "May 12, 2026 09:14 AM" |
| Category | Text |
| Related System | Text or "—" if empty |
| Requester | Full name |
| Requested Priority | Badge |
| Current Status | Badge |
| Summary | Full text, no truncation |
| Description | Full text, pre-wrap whitespace preserved |

All displayed in read-only styled boxes (`--color-readonly-bg`). No editable inputs.

### Attachments Section

#### Active Attachment Row
```
📄 report.pdf   2.3 MB   application/pdf   Uploaded May 12, 2026   [Download]  [Remove]
```
- Download triggers file download (opens new tab or triggers browser download)
- Remove opens confirmation dialog

#### Removed Attachment Row
```
📄 report.pdf   2.3 MB   application/pdf   [REMOVED]
   Removed: "No longer relevant to the issue"
```
- No Download button
- `[REMOVED]` badge with warning styling
- Removal reason shown in secondary text
- Row displayed with reduced opacity (0.6) to indicate inactivity

#### Add Attachment Button
- Visible at top-right of Attachments section header
- Disabled (greyed) with tooltip "Maximum of 5 attachments reached" when 5 active attachments exist
- Clicking opens file picker; file validated client-side before upload

#### Soft-Remove Confirmation Dialog
```
┌────────────────────────────────────────┐
│  Remove Attachment                     │
│  ─────────────────────────────────     │
│  Are you sure you want to remove       │
│  "report.pdf"?                         │
│                                        │
│  Removal Reason *                      │
│  [ Enter reason for removal…    ]      │
│                                        │
│  ⚠ This action cannot be undone.      │
│  The file will no longer be            │
│  downloadable.                         │
│                                        │
│        [Cancel]  [Confirm Remove]      │
└────────────────────────────────────────┘
```
- "Confirm Remove" disabled until reason field is non-empty
- "Confirm Remove" is **destructive** button style (red)
- Dialog is a modal overlay with focus trap

### Screen States

| State | Behaviour |
|-------|-----------|
| Loading | Spinner in content area; Back button still functional |
| Loaded | All fields and attachments rendered |
| Ownership failure (403) | "You do not have permission to view this ticket." message; Back to My Tickets link |
| Not found (404) | "Ticket not found." message; Back link |
| API failure | Error panel; Retry button |
| Attachment uploading | Inline progress indicator in attachment list; Add button disabled during upload |
| Attachment upload error | Inline error below attachment list; existing attachments unaffected |

---

## 11. Accessibility Rules

- All `<input>`, `<select>`, `<textarea>` elements have associated `<label>` (via `for`/`id` or `aria-labelledby`).
- Error messages are linked via `aria-describedby`.
- Required fields have `aria-required="true"` in addition to the visual asterisk.
- `aria-live="polite"` on success and error banner regions for screen reader announcements.
- `role="alert"` on inline error banners that appear dynamically.
- Focus is moved to the success panel heading after successful ticket creation.
- Focus is moved to the first error field after failed form submission.
- Modal dialogs trap focus (`focus-trap`) and return focus to the trigger element on close.
- Keyboard shortcut: `Escape` closes modals and dialogs.
- All interactive elements are reachable via `Tab`; active element has 2 px solid focus ring in `--color-focus-ring`.
- Color is never the **only** indicator of state (badges also use text labels; errors also use icons or text).
- ARIA labels on icon-only controls: `aria-label="Remove attachment"`, etc.

---

## 12. Responsive Breakpoints Reference

| Breakpoint | Range | Key Behaviour |
|-----------|-------|---------------|
| Mobile | < 768 px | Single column; hamburger nav; ticket cards instead of table; stacked buttons |
| Tablet | 768–991 px | Two-column form; table may hide low-priority columns; filter row wraps |
| Desktop | ≥ 992 px | Full multi-column layout; sidebar if used; full table with all columns |
| Wide | ≥ 1200 px | Content capped at max-width 1200 px; centered with equal side margins |

No horizontal page scrolling is permitted at any viewport. All text must remain readable (minimum 14 px effective size).

---

## 13. Visual Inspection Checklist

Complete this checklist during the final sprint review. Screenshot evidence required for each screen at all three viewport sizes.

### Screenshot Paths
| Screen | Desktop Path | Tablet Path | Mobile Path |
|--------|-------------|-------------|------------|
| Requester Selector | `artifacts/lab-02/screenshots/requester-selector/desktop.png` | `.../tablet.png` | `.../mobile.png` |
| Create Ticket (initial) | `artifacts/lab-02/screenshots/create-ticket/desktop-initial.png` | `.../tablet-initial.png` | `.../mobile-initial.png` |
| Create Ticket (validation) | `artifacts/lab-02/screenshots/create-ticket/desktop-validation.png` | | |
| Create Ticket (success) | `artifacts/lab-02/screenshots/create-ticket/desktop-success.png` | | |
| Create Ticket (API error) | `artifacts/lab-02/screenshots/create-ticket/desktop-error.png` | | |
| My Tickets (loaded) | `artifacts/lab-02/screenshots/my-tickets/desktop-loaded.png` | `.../tablet-loaded.png` | `.../mobile-loaded.png` |
| My Tickets (empty) | `artifacts/lab-02/screenshots/my-tickets/desktop-empty.png` | | |
| My Tickets (no-results) | `artifacts/lab-02/screenshots/my-tickets/desktop-no-results.png` | | |
| Ticket Detail (loaded) | `artifacts/lab-02/screenshots/ticket-detail/desktop-loaded.png` | `.../tablet-loaded.png` | `.../mobile-loaded.png` |
| Ticket Detail (removed attachment) | `artifacts/lab-02/screenshots/ticket-detail/desktop-removed-attach.png` | | |
| Ticket Detail (remove dialog) | `artifacts/lab-02/screenshots/ticket-detail/desktop-remove-dialog.png` | | |

### Checklist Items

#### Colors
- [ ] App header background is `#006B3C`
- [ ] Primary buttons use `#006B3C` background
- [ ] Page background is `#F5F7F6`
- [ ] Read-only fields have `#F0F4F1` background, visually distinct from editable
- [ ] Validation errors use `#B91C1C` text
- [ ] Success banners use `#EAF6EF` background with `#166534` text

#### Fields and Labels
- [ ] Every required field shows a red asterisk after the label
- [ ] Labels appear above (not beside) controls
- [ ] Consistent 40 px input height across all screens
- [ ] Description textarea is taller and vertically resizable only

#### Validation
- [ ] Field-level errors appear directly below the offending field
- [ ] No form-wide "something went wrong" as the **only** error message
- [ ] Error messages are descriptive and actionable

#### Buttons
- [ ] Submit button enters busy state (spinner + disabled) during submission
- [ ] Destructive actions (Remove) use red button style
- [ ] All buttons have visible text labels

#### Badges
- [ ] LOW / MEDIUM / HIGH / CRITICAL badges each have distinct color scheme
- [ ] NEW status badge renders correctly
- [ ] Removed attachment badge uses warning (amber) color

#### Responsive
- [ ] No horizontal scrolling at 375 px, 900 px, or 1280 px viewport widths
- [ ] No clipped labels or overlapping elements at any viewport
- [ ] My Tickets shows card layout on mobile, table on desktop
- [ ] Navigation collapses at mobile width
- [ ] Buttons remain touch-friendly (≥ 44 px touch target) on mobile

#### Accessibility
- [ ] Focus outlines visible on all interactive elements when keyboard navigating
- [ ] Modal dialog traps focus correctly
- [ ] Success and error states announced by screen reader (aria-live)
