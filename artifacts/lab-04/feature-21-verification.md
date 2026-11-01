# Feature 21 / GitHub issue #43 verification

Date: 30 October 2026 (Asia/Bangkok). Branch: `feature/21-ticket-workflow`.
Base: `085cecd` on `lab04-staging`, including owner-merged PRs #48 and #49.
Feature 22 preparation is in separate uncommitted files and is excluded here.

## Resulting behavior

- Enforces the complete eight-state/role ticket matrix and requester ownership.
- Direct resolution requires an active eligible owner, completed work, no open
  actions or outstanding non-cancelled follow-up. Reopening clears resolvedAt
  and requires newly created completed work before resolving again. Legacy
  resolved tickets can close without invented actions.
- All owner/priority/status/advisory and action writes share a parent row lock,
  optimistic versions and atomic audit persistence. Stale writes return 409;
  failures leave no partial update/history. Cancellation refuses active actions.
- Adds append-only shared ticket history and complete versioned workflow UI,
  actionable gate reasons and explicit stale-draft reconciliation. A single
  navigation guard covers simultaneous action/workflow drafts.
- Fills the supporting persistence gap left by the validation-only Feature 19
  PR: additive action/revision/workflow schema, action APIs, durable create keys,
  protected histories, safe DTOs and finalized identity snapshots. This does not
  claim the remaining Feature 19 repeat-seed/recovery work is complete.

## Executed verification

| Check | Actual result |
| --- | --- |
| Production build | Client Vite/TypeScript and server TypeScript passed |
| Server focused regression | 11 files, 222 tests passed; Lab 3 auth/queue/authorization plus Lab 4 action/workflow unit cases |
| Client focused regression | 7 files, 80 tests passed; workflow/action/auth/navigation/password |
| Real PostgreSQL API suite | 1 file, 23 tests passed, zero skipped |
| Populated migration | Prior three migrations -> synthetic existing user/ticket/attachment -> additive Lab 4 migration passed |
| Real browser workflow | 3 Chrome tests passed at desktop/tablet/mobile; no API route mocks |
| Full client suite | 83 tests passed; 6 unchanged Lab 2 suites fail collection on removed RequesterContext import |

Server focused command (from `server`):

```powershell
node ../node_modules/vitest/vitest.mjs run tests/lab-03 tests/lab-04/action-validation.unit.test.ts tests/lab-04/action-update.unit.test.ts tests/lab-04/action-workflow.unit.test.ts tests/lab-04/idempotency.unit.test.ts tests/lab-04/ticket-workflow.unit.test.ts
```

Other commands (from repository root):

```powershell
npm run build
npm run test --workspace=client -- src/features/ticket-workflow/ src/features/actions-taken/ src/lab-03/
npm run test:workflow-db
npm run test:workflow-browser
npm run test --workspace=client
```

The two isolated commands initialize real PostgreSQL 16.14 with UTF8/C locale,
generated credentials and a random loopback port. Child DATABASE_URL/JWT values
override configured application settings. The runner verifies legacy UTC
resolution estimates, unchanged original ticket fields/password hash/attachment
relationship, and no fabricated actions/history, then stops PostgreSQL. The
configured application database is never migrated by these tests.

DB cases cover all gate reasons, legacy close, fresh work after reopen,
ownership, advisory-versus-formal resolution, version errors, public audit scope,
transaction rollback, immutable audit triggers, tied-date ordering, pagination,
idempotent duplicate POSTs and true resolve-versus-create races. Cross-site writes
are rejected and preserved same-origin Host requests accepted.

Browser tests use real cookie authentication and HTTP -> API -> Prisma ->
PostgreSQL. They create/start/complete an action, resolve its ticket, reopen as
the requester, transition back to in-progress and verify fresh-work rejection.
They also check simultaneous dirty editors, rejected Back navigation, requester
absence of action mutation/private-note controls, no page errors and no page
overflow. Independent Prisma assertions reconcile the final ticket, completed
action and three status events after the browser exits.

## Actual iteration evidence

- An initial DB fixture attempted invalid completed work with follow-up; the DB
  CHECK rejected it. Corrected the fixture to valid open follow-up plus completed
  work; the gate then correctly explained both outstanding conditions.
- Initial browser checks exposed imprecise label selection, duplicate React keys
  between sibling editors, and the Vite proxy rewriting Host and rejecting valid
  same-origin writes. Fixed selectors, distinct editor keys, one shared draft
  guard and preserved proxy Host; final three-viewport real flow passed.
- Mounting protected ticket routers separately repeated account lookup and
  exposed a one-response legacy auth mock. Consolidated one account guard per
  ticket request; all 59 Lab 3 server tests pass.
- No failing assertions were removed or hidden. Real `.db.test.ts` cases are
  deliberately separate from ordinary Vitest and mandatory through their runner;
  direct invocation without an isolated test database fails rather than skips.

## Screenshots and limits

`screenshots/ticket-workflow/{desktop,tablet,mobile}-real-{resolved,reopened}.png`
contains real synthetic persistence screenshots at 1280x800, 900x1024 and 375x812,
captured from this branch working tree before commit. Desktop resolved and mobile
reopened images were visually inspected. No real user data or credentials appear.

These results do not certify every historical Lab 1/2 fixture, a full accessibility
audit, Safari, seed/recovery, dashboard performance or release completion. Those
remain their respective feature/release gates. Owner review and PR merge into
`lab04-staging` are still required before integrating Feature 22.
