# Lab 3 UI Specification — TokTickIT Zen Green Theme (Extended)

All Lab 2 design tokens, component states, spacing, typography, and responsive rules remain in force.
This document covers only Lab 3 additions and modifications.
Reference `docs/lab-02/ui-spec.md` for the complete baseline.

---

## 1. Design Principles (unchanged from Lab 2)

- Same Zen Green color tokens (`--color-primary: #006B3C`, etc.)
- Same input height (40 px), border-radius (6 px), and error styling
- All new screens must be visually indistinguishable in style from Lab 2 screens

---

## 2. New Badge Variants

| Badge | Background | Text | Label |
|-------|-----------|------|-------|
| Role: REQUESTER | `#E0F2FE` | `#0369A1` | Requester |
| Role: IT_STAFF | `#EDE9FE` | `#5B21B6` | IT Staff |
| Role: ADMINISTRATOR | `#FEF3C7` | `#92400E` | Admin |
| Status: OPEN | `#D1FAE5` | `#065F46` | Open |
| Status: IN_PROGRESS | `#DBEAFE` | `#1D4ED8` | In Progress |
| Status: WAITING_FOR_REQUESTER | `#FEF3C7` | `#92400E` | Waiting |
| Status: RESOLVED | `#EDE9FE` | `#5B21B6` | Resolved |
| Status: CLOSED | `#F3F4F6` | `#374151` | Closed |
| Status: REOPENED | `#FEE2E2` | `#991B1B` | Reopened |
| Status: CANCELLED | `#F3F4F6` | `#9CA3AF` | Cancelled |
| User: Active | `var(--color-pale-green)` | `var(--color-success-text)` | Active |
| User: Inactive | `var(--color-warning-bg)` | `var(--color-warning)` | Inactive |

---

## 3. Application Shell (Lab 3 changes)

### Header changes
- Replace Dev Requester name/Change Requester with: **[Role badge] [User full name] ▼**
- Dropdown on user name: "Change Password" + "Logout"
- Role-based nav links:
  - Requester: My Tickets | + Create Ticket
  - IT Staff: My Queue | + Create Ticket
  - Administrator: Admin

### Route guard behaviour
- Unauthenticated → redirect to `/login`
- `mustChangePassword = true` → redirect to `/change-password` (only this route accessible)
- Role mismatch → 403 page with "Return to Home" button

---

## 4. Login Screen

**Route:** `/login`

```
┌────────────────────────────────────┐
│        [TokTickIT logo]             │
│                                    │
│    Sign in to your account         │
│                                    │
│  Email address                     │
│  [______________________________]  │
│                                    │
│  Password                    [👁]  │
│  [______________________________]  │
│                                    │
│  ⓘ Invalid email or password.     │
│    Please try again.               │
│                                    │
│  [       Sign In        ]          │
│                                    │
│        Forgot your password?       │
└────────────────────────────────────┘
```

| Element | Detail |
|---------|--------|
| Email input | type="email", autocomplete="email", aria-required |
| Password input | type="password", show/hide toggle (eye icon), aria-label |
| Error message | Generic — "Invalid email or password. Please try again." |
| Inactive account | "This account is not active. Please contact your administrator." |
| Sign In button | Primary; disabled + spinner while in-flight |
| Forgot password | Link shown but leads to informational message (email reset not implemented in Lab 3) |

**States:** initial → validating (client) → submitting (API call) → success (navigate) | error (show message)

---

## 5. Change Password Screen

**Route:** `/change-password`
**Access:** Only when `mustChangePassword = true`; no other navigation visible

```
┌────────────────────────────────────┐
│  Change Your Password              │
│  You must change your password     │
│  to continue.                      │
│                                    │
│  Current (temporary) password      │
│  [______________________________]  │
│                                    │
│  New password                      │
│  [______________________________]  │
│                                    │
│  Confirm new password              │
│  [______________________________]  │
│                                    │
│  Password must:                    │
│  ✓ Be at least 8 characters       │
│  ✓ Include upper and lower case   │
│  ✓ Include a number               │
│  ✓ Include a special character    │
│                                    │
│  [        Continue         ]       │
└────────────────────────────────────┘
```

| Element | Detail |
|---------|--------|
| Rule checklist | Live feedback as user types; unfulfilled rules shown in `--color-error`; fulfilled rules in `--color-success-text` with checkmark |
| Confirm mismatch | Inline error below confirm field |
| New == current | Inline error below new-password field |
| Continue button | Primary; disabled until all rules met and passwords match |

---

## 6. IT Staff Ticket Queue Screen

**Route:** `/queue`
**Access:** IT Staff, Administrator

### Desktop layout (≥ 992 px)

```
┌──────────────────────────────────────────────────────────────┐
│ My Queue                          [↺ Clear Filters] [+ Ticket]│
│ View and prioritize the IT support queue.                     │
├──────────────────────────────────────────────────────────────┤
│ [🔍 Search by ticket number or summary…]        [≡ Filters ▼] │
│  Category[All▼]  Req.Pri[All▼]  IT Pri[All▼]  Status[All▼]   │
│  Owner [All▼]                                                  │
├──────────────────────────────────────────────────────────────┤
│ Ticket No↕ │ Created↕ │ Summary │ Cat │ Req.Pri │ IT Pri │ Status │ Owner │ Updated↕ │
│ ...        │ ...      │ ...     │ ... │ badge   │ badge  │ badge  │ ...   │ ...      │
├──────────────────────────────────────────────────────────────┤
│  Showing 1–10 of 87 tickets   [< Prev] [1][2][3]…[9] [Next >]│
└──────────────────────────────────────────────────────────────┘
```

**Mobile (< 768 px):** Cards showing Ticket No., Summary, Status badge, IT Priority badge, Owner, date.

### Filter controls
| Control | Options |
|---------|---------|
| Search | Ticket Number + Summary (debounced 300 ms) |
| Category | All + dynamic list |
| Requested Priority | All / LOW / MEDIUM / HIGH / CRITICAL |
| IT Priority | All / LOW / MEDIUM / HIGH / CRITICAL |
| Current Status | All + all 8 statuses |
| Owner | All / Unassigned / Me / specific user name |

### Column sort
Default: `createdAt desc`. Sortable: Ticket No., Created Date, Last Updated.

---

## 7. IT Staff Ticket Detail Screen

**Route:** `/tickets/:id` (IT Staff view)

```
┌──────────────────────────────────────────────────────────────┐
│ My Queue > Ticket Details                [← Back to Queue]   │
├──────────────────────────────────────────────────────────────┤
│ [READ-ONLY row]                                              │
│  Ticket No.    Ticket Date    Category    Related System      │
│  TKT-2026-000042  ...         Hardware   Corporate Laptop     │
│                                                              │
│  Requester     Req. Priority  Current Status [dropdown ▼]    │
│  Somchai J.    [MEDIUM badge] [IN_PROGRESS badge]            │
│                                                              │
│ [EDITABLE row]                                               │
│  Ticket Owner [dropdown ▼]    IT Priority [dropdown ▼]       │
│  Michael Brown                MEDIUM                         │
│                                                              │
│  Summary (read-only)                                         │
│  Laptop battery drains quickly                               │
│                                                              │
│  Description (read-only)                                     │
│  ...                                                         │
│                                                              │
│  [Save Changes]                                              │
├──────────────────────────────────────────────────────────────┤
│  [■ Public Comments (3)] [✎ Internal Notes (2)] [📎 Attach (2)] │
├──────────────────────────────────────────────────────────────┤
│  Add Public Comment                                          │
│  [Type your comment here…]           [Post Comment]          │
│  JA  Jennifer Anderson  Requester    May 13 11:45 AM         │
│      Thank you for the update...                             │
└──────────────────────────────────────────────────────────────┘
```

### Editable fields (IT Staff only)
| Field | Control | Constraints |
|-------|---------|-------------|
| Ticket Owner | Select: active IT Staff + Admin users | Nullable (Unassigned) |
| IT Priority | Select: LOW / MEDIUM / HIGH / CRITICAL | |
| Current Status | Select: only permitted next states from matrix | Shows current state; only valid transitions listed |

### Comments vs Notes visual distinction
- **Public Comments** tab: white background, green left border, label "Requester" / "IT Staff" / "Admin"
- **Internal Notes** tab: amber/ivory background (`#FFFBEB`), amber left border, lock icon on tab label, label "IT Staff" / "Admin"
- Notes tab is not rendered at all for Requester role

### Requester Ticket Detail extension
- Adds **Public Comments** section (same style as IT Staff view)
- Adds **Problem Appears Resolved** button below description:
  - Green secondary button, initially enabled
  - After click: disabled, shows "Marked as resolved on [date]"
  - Absent after `requesterResolvedAt` is already set

---

## 8. Administrator User Management Screen

**Route:** `/admin/users`

```
┌─────────────────────────────────┬────────────────────────────┐
│ Users              [+ Create]   │  Create New User        ×  │
│ Q Search users…    [≡ Filters]  │  Full Name *               │
│                                 │  [___________________]     │
│ Name ↕   Role ↕   Status ↕ Edit │  Email Address *           │
│ Jennifer [IT Stf] [Active] Edit │  [___________________]     │
│ Michael  [IT Stf] [Active] Edit │  Role *                    │
│ Sarah    [IT Stf] [Active] Edit │  [IT Staff ▼]              │
│ Kevin    [IT Stf] [Inact]  Edit │  Active                    │
│ Emily    [Reqstr] [Active] Edit │  [Yes ●]                   │
│ Admin U  [Admin]  [Active] Edit │  Initial Password          │
│                                 │  [___________________]     │
│                                 │  ⓘ User sets password on   │
│                                 │    first login.            │
│                                 │                            │
│                                 │  [      Save User      ]   │
│                                 │  [   Deactivate User   ]   │
│                                 │  [       Cancel        ]   │
└─────────────────────────────────┴────────────────────────────┘
```

| Element | Detail |
|---------|--------|
| User list | Name, Email (truncated), Role badge, Status badge, Edit button |
| Search | Case-insensitive on name or email (debounced 300 ms) |
| Role filter | All / Requester / IT Staff / Administrator |
| Create panel | Slide-in or inline panel; same Zen Green form styling |
| Deactivate button | Destructive red style; absent when editing self |
| Self-deactivation | Own row: Active toggle disabled, tooltip "You cannot deactivate your own account" |
| Last-admin guard | Shown as inline error on save attempt |
| Validation | Required field errors below each field; duplicate email: "This email address is already in use." |

---

## 9. Screenshot Paths

| Screen | Desktop | Tablet | Mobile |
|--------|---------|--------|--------|
| Login | `artifacts/lab-03/screenshots/authentication/desktop-login.png` | `.../tablet-login.png` | `.../mobile-login.png` |
| Change Password | `artifacts/lab-03/screenshots/authentication/desktop-change-pw.png` | | |
| IT Staff Queue | `artifacts/lab-03/screenshots/staff-queue/desktop-loaded.png` | `.../tablet-loaded.png` | `.../mobile-loaded.png` |
| IT Staff Detail | `artifacts/lab-03/screenshots/staff-ticket-detail/desktop-loaded.png` | `.../tablet-loaded.png` | |
| User Management | `artifacts/lab-03/screenshots/user-management/desktop-loaded.png` | | `.../mobile-loaded.png` |
| Requester (extended) | existing Lab 2 screenshots + new comment screenshots | | |

---

## 10. Visual Inspection Checklist

- [ ] Login screen uses `--color-primary` for Sign In button
- [ ] Password show/hide icon meets 44 px touch target
- [ ] Change Password rule checklist uses `--color-error` (unfulfilled) and `--color-success-text` (fulfilled)
- [ ] IT Staff Queue: Req. Priority and IT Priority badges use distinct colors from each other
- [ ] Status badges match the Badge Variants table in §2
- [ ] Role badges consistent: Requester (blue), IT Staff (purple), Admin (amber)
- [ ] Internal Notes tab visually distinct from Public Comments tab (amber tint + lock icon)
- [ ] IT Staff Detail: Status dropdown shows only permitted transitions, not all statuses
- [ ] Ticket Owner dropdown lists only active IT Staff and Administrator users
- [ ] User Management: inactive user rows show `[Inactive]` badge in warning amber
- [ ] No horizontal scroll at 375 px on any new screen
- [ ] Focus outlines visible throughout all new screens
- [ ] Logout accessible from every authenticated screen
- [ ] No unauthorised nav links visible for any role
