# Lab 4 UI Specification - TokTickIT Zen Green

**Draft.** Extends [Lab 2 design system](../lab-02/ui-spec.md) and [Lab 3 UI](../lab-03/ui-spec.md); where old wireframes conflict with the implemented secure baseline, [specification.md](specification.md) section 11 governs. This document describes intended behavior, not a visual test result.

## 1. Design tokens and shared components

| Purpose | Token/value |
| --- | --- |
| Primary / hover | `--color-primary #006B3C` / `#005530` |
| Secondary / focus | `#0B7A46`; visible 2px outline + 2px offset |
| Pale green / page / surface | `#EAF6EF` / `#F5F7F6` / white |
| Primary / secondary text | `#1A2E22` / `#4A6355` |
| Border / editable border | `#D1D9D4` / `#8BA89A` |
| Read-only / error / error background | `#F0F4F1` / `#B91C1C` / `#FEF2F2` |
| Spacing | 4, 8, 16, 24, 32, 48px; max content width 1200px |
| Typography | System sans; h1 24px/700, h2 18px/600, labels/body 14px, helper 13px |
| Form controls | 40px minimum height, 6px corners; textarea min 120px, vertical resize; touch targets at least 44px |

Reuse existing cards, tabs, form controls, badges and inline alerts; do not introduce a second CSS framework. Ticket status/priority/role labels remain textual as well as colored. Use readable cancelled text `#374151` on `#F3F4F6` instead of the legacy low-contrast grey text. New action badges: Planned grey; In progress blue (`#DBEAFE/#1D4ED8`); Completed green (`#D1FAE5/#065F46`); Cancelled grey. Include full labels, not color-only dots. Public action areas are white/green; Internal Notes retain amber background, lock icon and “Private: IT Staff/Admin only”.

## 2. Application shell and navigation

| Role | Navigation / default landing |
| --- | --- |
| Requester | Dashboard (`/dashboard`), My Tickets (`/tickets`), Create Ticket (`/tickets/new`) |
| IT Staff | Dashboard (`/dashboard`), Ticket Queue (`/queue`) |
| Administrator | Dashboard (`/dashboard`, staff view), Ticket Queue, User Management (`/admin/users`) |

Header displays user name/role, Change Password and Sign Out. Dashboard is the post-login home unless a safe permitted local return URL exists. Mandatory password change takes precedence; restore the safe destination afterward. Logged-out protected navigation goes to Login with redirectAfterLogin; external/protocol-relative return URLs are rejected. Existing account-help pages remain informational, not fake self-sign-up/email-reset implementations. Active page uses text/underline plus `aria-current="page"`.

## 3. Requester Dashboard

```text
Dashboard                         [Create Ticket]
My service requests               Updated [Bangkok timestamp]
[Open tickets] [Waiting for you] [Recently resolved] [Recently updated]
Recently updated tickets          [View matching tickets]
  Ticket number | Summary | Status | Updated | View
Recently resolved tickets         [View matching tickets]
  Ticket number | Summary | Resolved date (estimated where applicable) | View
```

Four metric cards use exact labels/counts from specification section 5. Show the seven-day date range near recent metrics. Waiting for you is emphasized but not red by default. Cards expose one clearly labelled link (“View 3 open tickets”), not nested competing clickable elements. Recent lists are capped to five each and are not full My Tickets tables. Empty account: all zeros, “No tickets yet” and Create Ticket. Zero subset: “No tickets waiting for you”/“No recently resolved tickets”. A zero card may still link to its empty filtered list.

## 4. IT Staff / Administrator Dashboard

```text
Dashboard                         [Open Ticket Queue]
Operational overview              Updated [Bangkok timestamp]
[Unassigned tickets] [My active tickets] [My active actions / related tickets]
Tickets by status                 Active tickets by IT priority
  eight labelled count links        four labelled count links
My active actions                 [View N related tickets]
  Ticket | Action description | Action status | Follow-up | View action
Recently updated tickets          [View matching tickets]
  Ticket | Summary | IT Priority | Status | Owner | Updated | View
```

My actions means assigned to the current user, not performed-by or Ticket Owner. Distinguish actionCount from distinct ticketCount and show up to five actions. The detail anchor scrolls/focuses the matching action; if on another page, fetch it by ID and open its view panel rather than silently missing it. No unimplemented urgent/SLA widget or admin account-count widget. Include all status/priority zero buckets. “No actions assigned to you” and “No recently updated tickets” are valid successful states.

## 5. Actions Taken on Ticket Detail

Keep ticket summary, existing attachment/public-comment/private-note sections and role visibility. Add an Actions Taken tab/section and a shared workflow history section. Ticket status and action status are visually and semantically distinct.

### List and view modes

- Desktop list columns: Action date/time, Description, Result, Performed by, Assigned to, Status, Follow-up, View/Edit. Long values wrap or show a short preview with a labelled View action button; full content is available without hover.
- Stable chronological order actionAt ASC,id ASC; default page size 10, options 10/25/50, labelled Previous/Next. Announce page changes.
- View panel includes all fields, attachment notes, creation/update timestamps, editor and expandable revision history. No delete button. “No recorded history” for legacy absence; do not invent events.
- Requesters see all action items and shared history on owned tickets, including completed/cancelled actions, but no New/Edit/Start/Complete/Cancel controls. Internal Notes remain absent from requester DOM and payload.
- Empty: “No actions recorded for this ticket.” Staff receives Add action only for active parent tickets.
- Explain shared visibility: “Actions and their history are visible to the requester. Put confidential information in Internal Notes.”

### Create and edit form

| Field | Control / behavior |
| --- | --- |
| Ticket number | Read-only; cannot reparent |
| Action date/time | Required datetime-local, Bangkok label; convert to explicit-offset ISO; initialize now; show original creation timestamp separately |
| Action description | Required textarea, 2000-character counter |
| Result | Textarea, 2000; required on Complete |
| Performed by | Read-only signed-in creator in create; immutable original creator in edit |
| Assigned to | Active staff/admin selector from `/api/queue/owners`; defaults to creator, independent of Ticket Owner |
| Follow-up required? | Accessible checkbox/switch labelled Yes/No |
| Follow-up note | Required visible textarea if true; changing to false explains clearing current note (history retained) |
| Attachment notes | Optional textarea, 1000; describes existing ticket files, not an upload widget |
| Action status | Create shows read-only Planned; edit shows current badge and allowed action controls |
| Cancellation reason | Required only when Cancel action chosen; nonblank, max 500 |

Buttons: Save action / Save changes (primary), Cancel editing (secondary); separate Start, Complete and Cancel action labels avoid confusing cancel-edit with cancel-work. Complete dialog/panel collects result and confirms no outstanding follow-up; Cancel action collects reason and explicit confirmation. Terminal actions are read-only; terminal parent shows “Reopen the ticket before recording more work.” Historical inactive assignee is shown with Inactive badge and replace prompt, not removed from historical display.

Keep draft text on 400/409/500/network errors, reset only after success or explicit discard. Disable duplicate submit in-flight, maintain the same idempotency key for retry of identical create intent, generate a new key for a genuinely new action. Confirm discard for dirty cancel/navigation. Session expiry redirects safely; do not persist private draft content in localStorage. Recoverable in-page errors preserve memory state; expired-session drafts may be cleared with an explicit warning.

## 6. Ticket workflow feedback and history

- Status dropdown lists current value plus permitted next edges for the current role. Requester sees only Reopen on own RESOLVED/CLOSED and the separate advisory control.
- Explain resolution requirements near the control: eligible owner, completed action, no open actions/follow-up, fresh work after reopening. Disable clearly impossible resolve with accessible explanation, but still handle backend 409 after racing changes.
- On gate failure show actionable reasons, e.g. “Complete or cancel 2 open actions before resolving.” Do not render a generic error page or bypass the gate through a different control.
- Successful transition refreshes ticket badge, allowed edges, version, history, action editability and affected dashboard caches. Do not label requester advisory as formally resolved.
- Conflict shows “This ticket changed while you were editing”; Reload latest reveals new values alongside retained draft and requires an explicit retry. Never auto-overwrite.
- Shared event history is chronological with actor, timestamp and changed public fields. Public comments and private notes remain append-only with stable tie-breaking; no edit/delete affordances.

## 7. Common state contract

| State | Required behavior |
| --- | --- |
| Loading | Labelled skeleton/status; avoid displaying zero counts as if loaded |
| Saving | Busy indicator, disabled submit, `aria-busy`; no duplicate operation |
| Success | Short `role=status` announcement; refreshed server values |
| Empty / no results | Relevant message plus Create Ticket/Clear filters/View queue as permitted |
| Validation | Field-local error linked via aria-describedby, aria-invalid; focus first invalid field |
| Forbidden (403) | Access denied plus permitted home link; no leaked preview; password-change code uses dedicated guard |
| Unauthenticated (401) | Safe return-to-login flow, no raw error page |
| Not found (404) | “Ticket/action not found” and safe back link |
| Conflict (409) | Preserve draft, explain reload/reconcile; gate conflicts list safe reasons |
| API/network failure | Inline safe message + Retry; retained draft; no stack trace or stale success |

Initial dashboard failure shows retry instead of fabricated zeros. Refresh failure may keep prior data only if visibly labelled “Could not refresh; showing data from [time]”. Clear user-specific caches on logout/account change so another user never sees stale private summaries.

## 8. Responsive and accessibility contract

Desktop >=992px: 3/4-card metric rows and bounded tables; tablet 768-991px: two-column cards and wrapping forms; mobile <768px: one-column cards, action/ticket card lists, stacked buttons, expanded readable fields. Validate 1280x800, 900x1024, 375x812 plus a 320px width/reflow check. No horizontal **page** scroll; prefer cards rather than requiring horizontal table scrolling.

Semantic h1/h2, main/nav landmarks, skip link, explicit labels and button names; visible keyboard focus, sensible tab order, Enter/Space activation; no hover-only controls. If dialogs are used, label them, trap focus, support Escape with dirty-discard confirmation, and restore focus to opener. Verify normal text contrast >=4.5:1, large text/non-text controls >=3:1, and 200% zoom. State announcements must not steal focus on routine refresh. Test long names, ticket summaries, unbroken attachment filenames and empty/null values. Respect reduced motion.

## 9. Screenshot and visual checklist (not yet executed)

Base `artifacts/lab-04/screenshots/`. Required major screens: staff-dashboard, requester-dashboard, actions-taken (list/create/edit/view), ticket-workflow. For each capture desktop/tablet/mobile loaded states; also validation, conflict, empty, forbidden and safe-failure examples. Use filenames `<viewport>-<state>.png`; include role, fixture, viewport, timestamp and commit SHA in evidence index. Do not use mock-only screenshots as proof of real API persistence.

- [ ] Exact Zen Green tokens and readable ticket/action/role/priority badges.
- [ ] Shared Actions Taken distinct from private notes; no private DOM/content for requester.
- [ ] Correct role navigation, active indicator, change-password and sign-out.
- [ ] Dashboard labels, zeros, recent window, action-vs-ticket counts and real drill-downs.
- [ ] Create/edit/read-only/terminal fields and conditional validation clearly distinguished.
- [ ] Loading, safe failure, forbidden, 404 and stale-conflict states exercised.
- [ ] Long text wraps; no clipping, overlap, horizontal page overflow or duplicate controls.
- [ ] Keyboard focus/order, screen-reader names, error/status announcements and dialogs checked.
- [ ] Desktop, tablet, mobile, 320px reflow, 200% zoom and contrast checks recorded.
- [ ] No obsolete Lab 2 identity selector/auth-coming notice, broken links, placeholders or console errors.
