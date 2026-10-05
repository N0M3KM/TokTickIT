# Lab 4 Test Plan and Results

**Planning baseline: 27 September 2026. All cases below are Planned, not Pass.** Paths designate test files to create, not evidence that they currently exist. Tests must precede or accompany implementation; record real red/green output. Full historical Lab 3 regression has known recorded failures and must be rerun/repaired, not assumed passing.

## 1. Strategy and execution rules

Use Vitest for pure functions, Supertest plus a disposable PostgreSQL database for API/transaction/security tests, React Testing Library for UI, Playwright for browser/E2E/visual/responsive tests, and manual keyboard/assistive-technology checks. Mocked UI tests supplement rather than replace real API/DB tests. Two independent DB connections are required for concurrency cases; an in-memory mock cannot prove locking.

Every row is an executable scenario group; parametrized cases may produce more test assertions than rows. All mandatory groups require actual passing assertions, not TODO/skip placeholders. Tests link Lab 4 AC identifiers; keep requirement IDs scoped to `docs/lab-04`.

## 2. Planned tests

### Unit

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-02 | Text trim/length, strict boolean, ISO offset/date and unknown-field validation, including limit +/-1 | Exact valid bounds accepted; invalid values rejected | `server/tests/lab-04/action-validation.unit.test.ts` | Planned |
| UNIT-02 | Unit | AC-03, AC-06 | Action transition matrix and completion/cancel/follow-up conditions | All listed edges allowed with valid guards; all omitted edges rejected | `server/tests/lab-04/action-workflow.unit.test.ts` | Planned |
| UNIT-03 | Unit | AC-08 | Every 8x8 ticket edge for all roles | Matrix exactly matches specification | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned |
| UNIT-04 | Unit | AC-09, AC-10 | Each resolution gate reason, cancellation and fresh-work gate | Correct safe blocking reasons, no advisory bypass | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned |
| UNIT-05 | Unit | AC-13, AC-14 | Active-status sets, aggregate predicates, distinct ticket versus action counts | Exact documented predicates; no joined count inflation | `server/tests/lab-04/dashboard-metrics.unit.test.ts` | Planned |
| UNIT-06 | Unit | AC-15 | Bangkok midnight/7-day boundaries; UTC/offset conversion | Inclusive start, exclusive asOf; identical instants equivalent | `server/tests/lab-04/dashboard-time.unit.test.ts` | Planned |
| UNIT-07 | Unit | AC-12 | Canonical idempotency business-payload fingerprint | Equivalent normalized input matches; versions excluded; changed intent differs | `server/tests/lab-04/idempotency.unit.test.ts` | Planned |
| UNIT-08 | Unit | AC-07, AC-16 | Stable tie-breakers and drill-down predicate builder | Deterministic order and same filter meanings | `server/tests/lab-04/dashboard-metrics.unit.test.ts` | Planned |

### API and integration

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
| --- | --- | --- | --- | --- | --- | --- |
| API-01 | API | AC-01 | Create by each staff/admin, default and different assignee | 201, correct parent/performer/assignee, revision1, unchanged Ticket Owner | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-02, AC-03 | Invalid fields/date boundaries, conditional notes/results/cancel reason | 400 with fields; zero action/history/parent writes | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-04 | Inactive/requester assignee, deactivation after form load and reassignment | Rejected until eligible assignee; cancel can retire inactive-assigned action | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | API | AC-06 | Edit/start/complete/cancel; all illegal edges and terminal-parent restrictions | Atomic correct edits; prohibited operations leave state unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | AC-07 | Equal timestamps, paged actions/history/comments/notes; edit/delete attempts on immutable resources | Stable ordering, retained revisions, no deletions | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | Integration | AC-11 | Two simultaneous PATCH requests with same versions | Exactly one winner; one 409; one new revision only | `server/tests/lab-04/action-concurrency.api.test.ts` | Planned |
| API-07 | API | AC-12 | Sequential/concurrent POST retry with same key, different key, altered payload, lost response | One row per intent; replay 200; changed payload 409; no extra history | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-08 | API | AC-08 | All ticket transitions by R own/R other/S/A, including direct endpoint bypass | Allowed edges only; ownership/role denial; advisory leaves status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-09 | API | AC-09 | Gate with no owner/inactive owner/no completed work/open action/follow-up and valid case | 409 per failed guard; valid resolution records timestamp/event | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-10 | API | AC-10 | Resolve-close-reopen-rework; legacy close/reopen; cancel with active action | Fresh-work rule enforced, timestamps correct, no cascade cancellation | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-11 | Integration | AC-11 | Resolution racing new action or action edit; injected failure before history write | One compatible outcome only; no resolved ticket with newly active work; complete rollback | `server/tests/lab-04/action-concurrency.api.test.ts` | Planned |
| API-12 | API | AC-13 | Two requesters with overlapping statuses and one empty requester | Own-only counts/previews; zeros/[]; no override identity | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-13 | API | AC-14 | Staff and admin metrics, multiple actions on one ticket, no assigned actions | Exact all-status/priority buckets, my actionCount and distinct ticketCount | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-14 | API | AC-15 | Frozen time; exact from/to, just outside, legacy estimate and reopened timestamps | Seven-day formulas correct; unknown history explicitly estimated | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-15 | API | AC-16 | Follow every requester metric href and page/filter combination | API totals equal metric definition on unchanged fixture; owner scope enforced | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-16 | API | AC-16 | Staff drill-downs, duplicate parent actions, time window, status/priority filters | Distinct parent count and exact queue predicates; no silent bad-filter fallback | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-17 | API | AC-19 | Malformed params, oversized body, missing parent, DB failure and stale payload | Documented safe status/code; no secrets or partial changes | `server/tests/lab-04/failures.api.test.ts` | Planned |
| API-18 | Integration | AC-07, AC-11 | Versioned owner/priority/advisory writes and shared history in same transaction | One version increment/event per success; stale calls rejected; original events retained | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |

### Security and authorization

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Authorization | AC-05 | R-own/R-other/S/A reads and writes across actions/detail/history; nested wrong parent | R reads own all actions only; writes403; wrong parent404; no leaks | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-02 | Authorization | AC-05, AC-17 | Missing/expired session, inactive user, mandatory password change, mismatched dashboard role | Correct 401/403 before data exposure | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-03 | Security | AC-02, AC-05 | Forged performer/editor/parent/time/version fields and HTML/script content | Protected fields rejected; text escaped; no stored XSS | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-04 | Security | AC-05, AC-24 | Response allowlists across dashboard/actions/history/errors; internal-note sentinel | No hashes/emails/private notes/diagnostics in shared responses | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-05 | Security | AC-12, AC-24 | Idempotency replay after permission loss; cross-origin mutation and cookie policy | Replay cannot bypass auth; mutation protections and credentialed-session policy retained | `server/tests/lab-04/authorization.api.test.ts` | Planned |

### UI components, style, responsive and accessibility

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | UI | AC-17 | Role home/nav, mandatory change, safe login return, cache clear on sign-out | Correct role destination; no previous user's dashboard | `client/src/lab-04/AppShell.test.tsx` | Planned |
| UI-02 | UI | AC-18 | Action list/create/edit/view, read-only actor, assignee and terminal states | All required controls and data visible only as permitted | `client/src/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-03 | UI | AC-03, AC-18 | Follow-up/result/cancel validation and inactive historical assignee | Clear field errors, required values, accessible reassignment | `client/src/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-04 | UI | AC-12, AC-19 | Double click, retry, stale conflict, server error, dirty cancel | Single intent; retained draft; explicit reconcile/discard | `client/src/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-05 | UI | AC-18, AC-19 | Ticket role transitions, gate reasons, advisory, refresh after success | Correct edges, actionable conflict, authoritative refreshed summary | `client/src/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-06 | UI | AC-13, AC-16, AC-19 | Requester cards/previews/drill-down/loading/zero/forbidden/error | Correct labels and URLs, no false zero on failure | `client/src/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-07 | UI | AC-14, AC-16, AC-19 | Staff cards/my actions/zero buckets/loading/forbidden/refresh error | Action versus ticket counts clear; stale data labelled | `client/src/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-08 | UI | AC-05, AC-07 | Shared history/list order and requester absence of private controls | All owned actions visible; no Internal Notes DOM | `client/src/lab-04/ActionsTaken.test.tsx` | Planned |
| STYLE-01 | UI style | AC-20 | Tokens/badges/read-only/private markers on all new screens | Computed style and approved visual baseline match ui-spec | `client/src/lab-04/ZenGreen.test.tsx` | Planned |
| RESP-01 | Responsive | AC-20 | All new screens at 1280x800,900x1024,375x812,320px; long data/200% zoom | No page overflow/clipping/overlap; usable controls | `e2e/lab-04/responsive.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-21 | Keyboard, labels, focus, announcements, dialog trap/return, contrast and reduced motion | Checklist passes; automated accessibility findings reviewed plus manual check | `e2e/lab-04/accessibility.spec.ts` | Planned |

### Migration, regression, performance and end-to-end

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
| --- | --- | --- | --- | --- | --- | --- |
| MIG-01 | Migration | AC-22 | Apply additive migration to populated pre-Lab4 DB with attachments/comments/notes/accounts | Counts/IDs/hashes/relations preserved; version1 and honest timestamp backfill | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| MIG-02 | Migration/recovery | AC-22 | Backup/restore DB plus files on disposable copy and run old application | Login and attachment download preserved; actual recovery output recorded | `server/tests/lab-04/recovery.integration.test.ts` | Planned |
| MIG-03 | Seed | AC-23 | Seed twice on clean and edited existing fixture | Stable counts/keys, passwords/edits not reset; required diversity present | `server/tests/lab-04/seed.integration.test.ts` | Planned |
| REG-01 | Regression | AC-24 | Full Lab1-3 unit/API/UI collection after legitimate authenticated fixture updates | No skipped/collection failures or hidden legacy regressions | Existing `server/tests/lab-01..03/`, client existing suites; `server/tests/lab-04/regression.api.test.ts` | Planned |
| REG-02 | Regression | AC-24 | Login/logout/me/change-password, rate-limit, help pages, inactive/last-admin/self protection, one-time generated passwords | Complete existing auth/admin flows and security retained | `e2e/lab-04/auth-admin-regression.spec.ts` | Planned |
| REG-03 | Regression | AC-24 | Create/My Tickets/queue/detail/filter, attachments/comments/private notes/reference data | Ownership, upload/download/remove and privacy preserved | `e2e/lab-04/ticket-regression.spec.ts` | Planned |
| REG-04 | Regression | AC-24 | Proxy to3001/health, no requesters enumeration route, dead links/console/placeholder controls | Working same-origin requests and coherent active UI | `e2e/lab-04/release-smoke.spec.ts` | Planned |
| PERF-01 | Performance-smoke | AC-25 | Both dashboard queries on fixed 1000-ticket/3000-action local fixture | p95<=1000ms warm sequential requests, <=100KiB response, bounded previews, no N+1 | `server/tests/lab-04/dashboard-performance.test.ts` | Planned |
| E2E-01 | E2E | AC-01, AC-04, AC-06, AC-18 | Staff A owns ticket, Staff B records/assigns/edits multiple actions, requester reads | Persistence after refresh; creator and assignee distinct; requester read-only | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-03, AC-08, AC-09, AC-10 | Create-to-close/reopen cycle, follow-up gate and explicit action cancellation | Correct full ticket lifecycle and no advisory bypass | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-13, AC-14, AC-15, AC-16, AC-17 | Each role dashboard versus independent DB queries and filtered destinations | Counts/previews/drill-downs correct before/after mutations | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-04 | E2E | AC-11, AC-12, AC-19 | Two browser sessions stale edit/resolve; dropped response and retry | Conflict reconciliation and no duplicate action; draft retained | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-05 | E2E | AC-20, AC-21, AC-24 | Role journeys/screenshots and manual keyboard checks using real service | Usable, secure, consistent app with no unexpected console failures | `e2e/lab-04/final-regression.spec.ts` | Planned |
| DOC-01 | Release/evidence | AC-26 | Review contract timing, test links, actual approvals, Git graph, Kanban and nine PDF parts | Every release gate has genuine evidence on final main SHA | Manual checklist: `docs/lab-04/submission-checklist.md` | Planned |

## 3. Acceptance-criterion traceability

| AC | Planned tests |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | UNIT-01, API-02, SEC-03 |
| AC-03 | UNIT-02, API-02, UI-03, E2E-02 |
| AC-04 | API-03, E2E-01 |
| AC-05 | SEC-01..04, UI-08 |
| AC-06 | UNIT-02, API-04, E2E-01 |
| AC-07 | UNIT-08, API-05, API-18, UI-08 |
| AC-08 | UNIT-03, API-08, E2E-02 |
| AC-09 | UNIT-04, API-09, E2E-02 |
| AC-10 | UNIT-04, API-10, E2E-02 |
| AC-11 | API-06, API-11, API-18, E2E-04 |
| AC-12 | UNIT-07, API-07, SEC-05, UI-04, E2E-04 |
| AC-13 | UNIT-05, API-12, UI-06, E2E-03 |
| AC-14 | UNIT-05, API-13, UI-07, E2E-03 |
| AC-15 | UNIT-06, API-14, E2E-03 |
| AC-16 | UNIT-08, API-15..16, UI-06..07, E2E-03 |
| AC-17 | SEC-02, UI-01, E2E-03 |
| AC-18 | UI-02..03, UI-05, E2E-01 |
| AC-19 | API-17, UI-04..07, E2E-04 |
| AC-20 | STYLE-01, RESP-01, E2E-05 |
| AC-21 | A11Y-01, E2E-05 |
| AC-22 | MIG-01..02 |
| AC-23 | MIG-03 |
| AC-24 | SEC-04..05, REG-01..04, E2E-05 |
| AC-25 | PERF-01 |
| AC-26 | DOC-01 |

## 4. Fixtures, concurrency and independent oracles

- Use isolated disposable DBs, never a user's working database for destructive tests. Back up before migration testing; do not run seed/reset just to collect screenshots.
- Fixed test clock example `2026-09-27T05:00:00Z` gives from `2026-09-20T17:00:00Z` (21 September Bangkok midnight). Include timestamps exactly from, from-1ms, to-1ms and to; exact to is excluded.
- At least two owners, one requester with zero tickets, active/inactive staff and admin. Include every ticket/action state/priority, multiple actions per parent, different owner/creator/assignee, and same-timestamp ties.
- Reconcile aggregates with independent SQL/query assertions, not the same production helper on both sides of an assertion. Count tickets distinctly; myActions action count may exceed its parent ticket count. Record query, parameters and expected/actual values.
- Control race execution with barriers on separate DB connections; do not rely solely on arbitrary sleep. Check final DB rows, parent/action versions and history cardinality after racing requests and rollback.
- Performance fixture: 1000 tickets and 3000 actions, 5 warmups then 30 measured sequential requests per endpoint on local Docker/PostgreSQL; record machine/runtime/DB versions and p50/p95. Budget <=1000ms p95 and <=100KiB JSON is a proposed local smoke target, not a production SLA. Inspect EXPLAIN ANALYZE for avoidable scans/N+1; test load data exists only in disposable DB.

## 5. Planned execution commands and result recording

Commands below are instructions for future implementation/release, **not commands executed by this draft task**. Run from repository root after test files exist and the database/environment has been checked:

```powershell
npm ci
npm run build
npm run test --workspace=server -- tests/lab-04
npm run test --workspace=client -- src/lab-04
npx playwright test e2e/lab-04
npm run test --workspace=client
npm run test --workspace=server
npx playwright test
```

Run client/server suites separately so a failed client command cannot prevent recording server results. Confirm Playwright configuration/environment points to the intended real local services, server port3001 and isolated fixtures. Install browser/test-only dependencies only when implementing tests and update lockfile intentionally. Migration commands must use the correct environment and a backed-up disposable clone; do not blindly run `migrate reset`.

Record command, branch/SHA, runtime, database/seed identity, start time, exit code, passed/failed/skipped counts, test file and artifact paths. Failed collection is failure, not “zero failing tests”. Mark Final only from observed output; retain failure and fix evidence. Retest all required suites on final main after authorized release integration.

## 6. Visual, accessibility and evidence gates

Complete every checkbox in [ui-spec.md](ui-spec.md) section 9; attach screenshot path, actual viewport, role, state, reviewer and result. Capture real Actions Taken create/edit/complete/cancel/validation/conflict, dashboard zero/nonzero/loading/failure/forbidden and workflow gate states. Use `artifacts/lab-04/screenshots/staff-dashboard/`, `requester-dashboard/`, `actions-taken/`, `ticket-workflow/`; regression captures may have their own subfolder.

Store sanitized command logs/DB reconciliation/recovery output in `artifacts/lab-04/test-results/`, and an evidence index with main SHA in `artifacts/lab-04/README.md` during feature24. Do not commit credentials, session cookies, real personal data, copied databases or uploaded private files. All implementation test files and evidence directories remain to be created by their assigned features.
