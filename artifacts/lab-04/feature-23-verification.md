# Feature 23 / GitHub issue #45 verification

Date: 31 October 2026 (Asia/Bangkok). Branch: `feature/23-staff-dashboard`.
Base: `e33e80e`, after the owner's Feature 22 PR #51 merge into `lab04-staging`.
No PR creation, merge, peer approval or issue-Done action is claimed here.

## Implemented behavior

- Staff and administrators now land on their operational `/dashboard`, with
  Dashboard, Ticket Queue and applicable User Management navigation. Requester
  dashboard/navigation and safe return/password flows remain available.
- GET `/api/dashboards/staff` serves staff/admin only. It computes active
  unassigned and current-user-owned tickets, all eight status buckets, all four
  active IT-priority buckets, recent tickets and current-user assigned actions.
- Administrators share global staff scope but use their own identity for personal
  counts. Action assignment is distinct from performer and Ticket Owner.
- `actionCount` and distinct parent `ticketCount` are separate. Parent predicates
  use EXISTS; multiple actions cannot multiply ticket totals. All zero buckets
  are included. Lists are bounded to five, descriptions to 120 Unicode code
  points, and DTOs contain no internal notes, secrets or full collections.
- Snapshot/timezone/recent-window behavior reuses the requester contract in one
  RepeatableRead transaction. Dashboard query overrides are rejected.
- Queue dashboard filters AND with legacy search/category/priorities/status/owner.
  All sorts have ID tie-breakers; recent drill-downs use updatedAt DESC/id DESC.
  URL state survives reload, Back, pagination, sorting and detail navigation.
- Individual action links fetch and focus an action even outside the first list
  page. Authentication and mandatory-password return paths now preserve hashes.
- UI handles loading, zero, empty, denied, missing and safe retry states. Refresh
  failure may retain only visibly dated old data. Identity/role changes and
  cancelled requests cannot expose a prior user's cached personal metrics.

## Executed checks

| Check | Actual result |
| --- | --- |
| Production build | Client Vite/TypeScript and server TypeScript passed |
| Focused client regression | 11 files, 146 tests passed, including 23 staff dashboard and 13 queue cases |
| Focused server regression | 13 files, 268 tests passed |
| Real PostgreSQL suites | 75 tests passed: 21 staff, 31 requester, 23 workflow |
| Staff/admin real browser | Four viewport tests passed |
| Requester real browser regression | Four viewport tests passed with updated staff/admin dashboard home expectations |
| Full client suite | 149 tests passed; six unchanged Lab 2 suites fail collection on removed RequesterContext imports |

Commands from repository root:

```powershell
npm run build
npm run test --workspace=client -- src/features/ src/lab-03/
npm run test:workflow-db
npm run test:staff-dashboard-browser
npm run test:requester-dashboard-browser
npm run test --workspace=client
```

Server focused command from `server`:

```powershell
node ../node_modules/vitest/vitest.mjs run tests/lab-03 tests/lab-04
```

DB cases independently reconcile all metrics/buckets/previews with SQL, compare
every queue link's total/predicate, exercise assignment versus creator/owner,
inactive historical performers, terminal parents, ties and range boundaries,
genuine global empty buckets, unauthorized/forged queries and concurrent commits
under one read snapshot. Existing requester/workflow cases remain executed.

Browser tests use real sign-in/cookies, HTTP, API routes, Prisma and PostgreSQL.
They reconcile dashboard values with SQL, verify two actions on one related
ticket, queue URL/paging/Back/reload behavior, and focus a linked action after ten
earlier completed actions. Admin personal metrics differ from staff while global
status buckets match. A further account with no assigned actions has zero personal
counts; requester access to staff APIs is denied. Skip link, active navigation,
page errors and horizontal overflow are checked at all viewports.

## Both-endpoint performance smoke

Environment: Windows 11 Home Single Language 10.0.22631, AMD Ryzen 7 5800H,
Node v24.14.0, Prisma 6.16.0, pinned native PostgreSQL 16.14. These are local
native-process measurements, not Docker or production service guarantees.

A further generated database inside the disposable cluster contains exactly
1000 tickets and 3000 actions. Each endpoint receives five warmups then thirty
sequential measured requests. Logged Prisma dashboard statements exclude
transaction-control statements; authentication uses matching synthetic identities
in the runner DB and its time remains included in the request duration.

| Endpoint | p50 | p95 | Max JSON bytes | Constant dashboard SQL statements |
| --- | --- | --- | --- | --- |
| requester | 10.72 ms | 13.98 ms | 3373 | 9 |
| staff | 18.05 ms | 21.97 ms | 3862 | 12 |

Both endpoints satisfy the <=1000 ms p95 and <=100 KiB local smoke targets.
Previews remain bounded at five; query counts remain constant with no per-item
N+1 loop. A representative distinct-parent EXPLAIN ANALYZE uses the action
assignee/status index and Ticket primary key, with 1.881 ms execution time.
The performance database is dropped and the disposable cluster stopped; no
configured application database is read, seeded or migrated by these checks.

## Screenshots and remaining gates

`screenshots/staff-dashboard/{desktop,tablet,mobile,narrow}-real-{staff,admin,queue}.png`
contains synthetic real persistence views at 1280x800, 900x1024, 375x812 and
320x812, captured from the feature working tree before commit. Desktop staff and
mobile queue images were visually inspected. No real user data or credentials
appear. Requester regression screenshots were restored to their Feature 22
committed versions to preserve that historical evidence.

Observed implementation iterations: runtime action-description limits were
aligned to backend Unicode code-point truncation and boundary-tested. The
requester browser's old queue/admin landing expectations were updated to the
deliberate Feature 23 dashboard home behavior; its real role flow passed again.
No assertions were removed, auth bypassed or legacy failures hidden.

Feature 23 is ready for the owner's reviewed PR into `lab04-staging`. Feature 24
remains a separate release task: historical fixture repair/full regression,
complete accessibility/visual checklist, recovery/seed evidence, real peer review,
final-main verification and submission artifacts are not certified by this file.
