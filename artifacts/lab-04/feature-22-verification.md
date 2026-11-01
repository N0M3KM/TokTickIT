# Feature 22 / GitHub issue #44 verification

Date: 31 October 2026 (Asia/Bangkok). Branch: `feature/22-requester-dashboard`.
Base: `4ca1363` on `lab04-staging`, after the owner merged Feature 21 PR #50.
The earlier isolated preparation is now integrated. No PR, merge or issue-Done
action is part of this implementation; the owner retains those steps.

## Resulting behavior

- Requesters land on `/dashboard` after ordinary sign-in; safe explicit return
  paths and mandatory password change retain precedence. Staff/admin `/dashboard`
  navigation redirects to their existing queue/admin landing until Feature 23.
- GET `/api/dashboards/requester` returns four backend-owned metrics and bounded
  recent/resolved previews from one RepeatableRead snapshot with one timestamp.
  Current session identity determines ownership; query overrides are rejected.
- Recent windows include Bangkok midnight six calendar dates before today and
  exclude the snapshot instant. Estimated legacy resolutions remain counted and
  labelled. All zero buckets and empty lists are valid successful responses.
- Card/list links open equivalent My Tickets predicates with canonical recent
  timestamp/ID sorting. Search, category, priority and status combine with AND.
  Filters, ranges, paging and sort survive reload, detail navigation and Back.
- My Tickets now displays all eight statuses and real mobile cards; sortable
  headers use buttons and aria-sort. It cancels superseded requests and avoids
  rendering results belonging to an old query/account.
- Dashboard loading/empty/denied/missing/failure states are explicit; failed
  refresh may retain only a clearly dated previous snapshot. No user data is
  stored in browser storage or module-global caches. Runtime response validation
  allowlists links/DTOs and strips private or unexpected content.

## Executed verification

| Check | Actual result |
| --- | --- |
| Production build | Client Vite/TypeScript and server TypeScript passed |
| Client focused suites | 9 files, 109 tests passed; 19 new dashboard and 10 new My Tickets cases plus retained workflow/action/auth checks |
| Server focused suites | 12 files, 259 tests passed; includes 37 prepared date/scope/filter cases |
| Real PostgreSQL API suites | 54 tests passed: 31 requester dashboard cases and 23 retained workflow cases |
| Real browser flow | Four Chrome viewport tests passed at 1280x800, 900x1024, 375x812 and 320x812 |
| Full client suite | 112 tests passed; six unchanged Lab 2 suites fail collection because RequesterContext no longer exists |

Commands from repository root:

```powershell
npm run build
npm run test --workspace=client -- src/features/requester-dashboard/ src/features/my-tickets/ src/features/actions-taken/ src/features/ticket-workflow/ src/lab-03/
npm run test:workflow-db
npm run test:requester-dashboard-browser
npm run test --workspace=client
```

Server focused command, from `server`:

```powershell
node ../node_modules/vitest/vitest.mjs run tests/lab-03 tests/lab-04
```

Real `.db.test.ts` cases require the dedicated disposable runner and are excluded
from ordinary Vitest; this is not a passing/skip claim for unexecuted DB cases.
The runner initializes PostgreSQL 16 with generated credentials on a random
loopback port, preserves synthetic populated migration data and stops afterward.
No configured application database was queried, seeded or migrated.

### Independent database and browser evidence

DB cases reconcile metric counts and preview order against independent SQL;
check exact lower/upper boundaries, timestamp ties, estimated legacy resolution,
zero-ticket accounts, role/password/inactive guards, forged identity/window/query
parameters and simultaneous database changes during a repeatable snapshot.
Dashboard/list totals and their predicates match without multiplying tickets by
action rows. Canonical `sort=resolvedAt` is tested using the exact UI request.

Browser tests use actual sign-in, cookies, API routes, Prisma and PostgreSQL with
no route interception. They reconcile the UI snapshot with SQL, follow metric
links, paginate/reload, open ticket detail and return with Back, check estimated
dates and staff/admin landing, then switch to a zero-ticket account and confirm
the prior account's data is absent. Keyboard Skip to main content, active nav,
page errors and horizontal overflow are asserted at all four viewport sizes.

### Requester-only performance smoke

Environment: Windows 11 Home Single Language 10.0.22631, AMD Ryzen 7 5800H,
Node v24.14.0, Prisma 6.16.0, disposable PostgreSQL 16.14 via pinned
`embedded-postgres@16.14.0-beta.17` (native local process, not Docker).

Fixture: 1000 owned tickets and 3000 actions, five warmups followed by 30 measured
sequential requests. Final run: **p50 9.67 ms, p95 10.41 ms, max JSON 3995 bytes**.
Both lists remain capped at five; counts remain independent of action count.
The requester endpoint meets the local <=1000 ms / <=100 KiB smoke limits.
The staff endpoint and complete two-endpoint PERF-01 remain Feature 23 work.
No production performance guarantee or complete query-plan audit is claimed.

## Screenshots and review limits

`screenshots/requester-dashboard/{desktop,tablet,mobile,narrow}-real-{dashboard,drilldown,empty}.png`
captures real synthetic account data from this branch working tree before commit.
Desktop drill-down and mobile dashboard were visually inspected. Visual review
caught garbled inherited sort indicators; readable ASCII labels replaced them,
the My Tickets tests passed again, and browser screenshots were regenerated.

The initial stricter backend sort validation rejected the UI's `resolvedAt` sort;
the allowed canonical request and a regression test corrected that mismatch.
DB-test iteration also corrected an inactive-account expected status to the
existing 401 guard and restored a Prisma transaction spy without proxy effects.
No assertions were removed, auth bypassed or test failures hidden.

All historical Lab 1/2 fixtures, complete accessibility/zoom/contrast auditing,
Safari, final peer review and release evidence remain their documented release
gates. Feature 23 integration requires the owner's reviewed Feature 22 PR merge
into `lab04-staging` first.
