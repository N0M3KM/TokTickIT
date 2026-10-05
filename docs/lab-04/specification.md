# Lab 4 Sprint Engineering Specification

**Draft for approval.** Source: `SE+Lab+4 (1).pdf`. Lab 4 identifiers below are scoped to this folder, not Lab 3 identifiers. Proposed implementation choices are distinguished in section 11. No implementation or test completion is claimed.

## 1. Sprint Goal

Complete TokTickIT's service-desk workflow with traceable Actions Taken, an enforced resolution gate, concise role-specific dashboards, and verified regression, accessibility and Zen Green consistency across Labs 1-4, without discarding existing data.

## 2. Stakeholder Request Interpretation

The Ticket Owner coordinates the overall case while other permitted staff can perform and record individual actions. Requesters see work on their own tickets and may advise that a problem appears resolved, but formal resolution remains a staff decision. Dashboards guide users to actionable detailed views rather than replace those views. Completion must be demonstrated through reproducible tests and review evidence.

## 3. Scope

### Included

- Action model, migration, seed, list/create/assign/edit/start/complete/cancel, automatic actor attribution, follow-up and attachment notes.
- Requester read-only access to **all** Actions Taken on owned tickets; staff and administrator write access enforced by the API.
- Complete ticket transition matrix, resolution conditions, stale-update protection and append-only history.
- Requester and staff dashboards; administrator reuses the staff dashboard; current-user actions, exact counts, bounded recent lists and matching drill-downs.
- Preservation of authentication, password changes, user administration, requester ownership, queue, comments, internal notes, attachments and reference data.
- Responsive/accessibility checks, safe errors, duplicate prevention, evidence, README updates, staged review and final regression.

### Explicitly excluded

Automatic SLA clocks, escalations, on-call scheduling, breach notifications; email/SMS/LINE/push services; inventory, spare parts, purchasing, service-cost accounting; timesheets, billing and payroll; multi-level approvals and electronic signatures; advanced BI, custom report builders and warehouses; multi-tenancy and production-scale cloud operations; unapproved product features. No new registration/email-reset service, action file-storage system, hard deletion or action bulk operations. Existing attachments remain the file mechanism; Attachment Notes reference them as text.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | Store multiple Actions Taken under exactly one existing ticket per action. |
| FR-02 | Support action date/time, description, result, automatic performed-by, follow-up flag/note and attachment notes. |
| FR-03 | Staff/admin can create, assign, edit and transition accessible actions; creator, editor and assignee are distinct identities. |
| FR-04 | Reject inactive/requester assignees and forged actor/parent fields server-side. |
| FR-05 | Requesters can read all actions on owned tickets, never write actions or read other requesters' data. |
| FR-06 | Provide action list, create and view/edit modes, with stable ordering and readable history. |
| FR-07 | Implement the full eight-state ticket matrix, including authorized requester reopening. |
| FR-08 | Enforce the resolution gate server-side, including direct API calls and concurrent child changes. |
| FR-09 | Keep requester resolution indication advisory and preserve append-only comments, notes and workflow history. |
| FR-10 | Detect stale action/ticket writes; no silent last-write-wins or duplicate create on retry. |
| FR-11 | Calculate requester-owned dashboard metrics and bounded recent tickets on the backend. |
| FR-12 | Calculate staff/admin metrics, current-user Actions Taken and recent tickets on the backend. |
| FR-13 | Every metric has a defined query, time window, zero state and detailed destination using equivalent filters. |
| FR-14 | Add role-specific Dashboard navigation/default home without losing existing permitted routes. |
| FR-15 | Preserve Zen Green components, distinguish shared/private content and editable/read-only fields. |
| FR-16 | Provide consistent loading, saving, success, validation, empty, forbidden, conflict, not-found and API-failure states; preserve drafts after recoverable failure. |
| FR-17 | Deliver keyboard-operable, labelled, responsive screens without page overflow at required viewports. |
| FR-18 | Apply additive Prisma migrations, explicit legacy behavior, tested recovery and idempotent seed data. |
| FR-19 | Preserve and retest all Lab 1-3 functionality and security; repair obsolete test fixtures rather than hiding failures. |
| FR-20 | Finish traceable tests, visual evidence, review records, setup/demo documentation and approved staged release evidence. |

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-01 | Each action has one immutable `ticketId`; moving/reparenting or deleting an action is not supported. |
| BR-02 | A Ticket Owner coordinates the ticket; an action's performer/assignee may be another staff/admin. Creating or assigning an action never silently changes the Ticket Owner. |
| BR-03 | Only active authenticated staff/admin with password-change requirements satisfied may write actions. Staff can access all tickets as in Lab 3. |
| BR-04 | `performedById` is the authenticated creator, immutable and automatic; `updatedById` records each editor. `assigneeId` is a required active IT_STAFF/ADMINISTRATOR, defaulting to the creator. Performed-by does not mean the current assignee. |
| BR-05 | Server controls `createdAt`, `updatedAt`, IDs, versions and audit timestamps. `actionAt` is a required ISO instant with explicit offset, default now in UI, not earlier than ticket creation or later than server now plus five minutes. Five-minute tolerance is a proposed clock-skew allowance. |
| BR-06 | Trim plain-text description (1-2000 chars), result (0-2000), follow-up note (0-2000), attachment notes (0-1000), cancellation reason (0-500). Render text escaped. Required text cannot be whitespace. |
| BR-07 | `followUpRequired` is a strict boolean. When true, nonblank follow-up note is required. When false, note must be empty/null and is stored null; prior content remains in history. Completion requires false and a nonblank result. |
| BR-08 | Create an action as PLANNED. Action matrix below is exhaustive; omitted transitions and same-state writes are rejected. COMPLETED/CANCELLED are immutable terminal states. |
| BR-09 | No action creation/edit/transition on RESOLVED, CLOSED or CANCELLED tickets. Reopen the ticket before further work; existing actions remain visible. Cancellation of a ticket requires all its actions already terminal. |
| BR-10 | Ticket matrix below is exhaustive. Only staff/admin formally resolve/close/cancel; requester may reopen own RESOLVED/CLOSED ticket and submit the advisory indicator. |
| BR-11 | To enter RESOLVED: active eligible Ticket Owner, at least one COMPLETED action, zero PLANNED/IN_PROGRESS actions, and no non-cancelled action with follow-up outstanding. Completed actions have nonblank results. Check within the same transaction as the transition. |
| BR-12 | Record `resolvedAt` on entering RESOLVED; retain it through CLOSED; clear it on REOPENED. A reopened ticket needs a newly completed action created at or after its latest `reopenedAt`, in addition to BR-11, before resolving again. |
| BR-13 | Legacy resolved/closed tickets with no actions are readable and are not retroactively invalidated. Legacy RESOLVED may close. Reopened legacy tickets use the new gate. Legacy active tickets need real completed work, not fabricated backfill actions. |
| BR-14 | Requester advisory indication does not resolve an action/ticket or satisfy BR-11. Preserve existing once-only indication behavior; reopening does not fabricate/delete the earlier indication. |
| BR-15 | Actions ordered `actionAt ASC, id ASC`; histories/comments/notes ordered `createdAt ASC, id ASC`. Pagination must retain deterministic tie-breakers. No edit/delete API for history, comments or internal notes. |
| BR-16 | Action changes append immutable revisions; ticket owner/priority/status changes append immutable workflow events. Current snapshots may change only with a new history entry in the same transaction. Requesters see shared action/ticket events, never internal notes, credentials or private diagnostics. |
| BR-17 | Every ticket owner/priority/status/advisory write requires expected ticket version; action PATCH requires expected action and ticket versions; action creation requires expected ticket version. Increment parent ticket version on action writes so resolution and action creation cannot race. |
| BR-18 | Use transactionally checked versions and a shared parent ticket write/lock for every action/workflow write. A failed validation, stale conflict or retry cannot leave partial state/history. Successful action writes update parent `updatedAt`; private internal notes do not update dashboard-visible parent timestamps. |
| BR-19 | Action POST requires an idempotency UUID unique per creator/ticket. Same key and normalized business payload returns the existing result without extra rows; changed business payload returns 409. Authentication/authorization is rechecked on replay. Expected versions are excluded from payload equivalence. |
| BR-20 | Active ticket set = NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED. RESOLVED, CLOSED and CANCELLED are not open. Action-active set = PLANNED, IN_PROGRESS. |
| BR-21 | Requester metrics always filter `requesterId` from the authenticated session; no caller-selectable requester identity. Staff scope is all tickets; `mine` means current session user, not Ticket Owner inferred from action creator. |
| BR-22 | Dashboard counts come from database aggregation; never from a page of client data. Execute metrics and bounded lists under one read snapshot; return `asOf` and window boundaries. |
| BR-23 | Store instants in UTC and display Asia/Bangkok. Recent window is seven Bangkok calendar days: midnight six days before today inclusive through snapshot `asOf` exclusive. Frozen-clock fixtures test exact boundaries. |
| BR-24 | Recent ticket lists have at most five entries, ordered `updatedAt DESC, id DESC`; recently resolved uses `resolvedAt DESC, id DESC`. Zero counts are 0, lists [], and no matching record is not an error. |
| BR-25 | Action history remains attributable after account deactivation. New/reassigned work must reference an active eligible assignee. If an assignee becomes inactive, staff must reassign open work before starting/completing it; cancellation remains allowed. |
| BR-26 | Retain httpOnly cookie authentication, same-origin credentials, login rate limiting, backend role/ownership checks, mandatory password change and safe local return URLs. Never return password hashes, stack traces or internal-note content in shared endpoints. |
| BR-27 | Never reset existing data to demonstrate migration. Seeds upsert only stable demo identities/keys and do not reset existing passwords, edited tickets or user state on rerun. No real credentials in docs/artifacts. |
| BR-28 | Dashboard links enforce the same backend authorization as direct URLs. Numeric totals must match destination totals for the returned snapshot/time bounds, allowing only explicitly explained subsequent live mutations. |

### Complete ticket transition matrix

R = authenticated owning Requester; S = IT Staff; A = Administrator. All require current version. Unlisted edges are invalid, including same-state writes.

| From | Permitted destination(s) | Roles | Additional condition |
| --- | --- | --- | --- |
| NEW | OPEN, CANCELLED | S/A | Cancel only with no active actions |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED | S/A | Cancel only with no active actions |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | S/A | Resolution gate; cancellation gate |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED | S/A | Resolution gate for RESOLVED |
| RESOLVED | CLOSED | S/A | Preserve resolution evidence, including legacy exception |
| RESOLVED | REOPENED | R/S/A | Set reopenedAt and clear resolvedAt |
| CLOSED | REOPENED | R/S/A | Same reopening rules |
| REOPENED | IN_PROGRESS, CANCELLED | S/A | Cancellation gate |
| CANCELLED | None | None | Terminal |

Status changes do not cascade action transitions. Staff explicitly completes/cancels each action. Invalid matrix edge: 400; unmet gate or stale state: 409; unauthorized role: 403.

### Complete action transition matrix

| From | To | Roles and guard |
| --- | --- | --- |
| PLANNED | IN_PROGRESS | S/A; active eligible assignee |
| PLANNED | CANCELLED | S/A; nonblank cancellation reason |
| IN_PROGRESS | COMPLETED | S/A; active eligible assignee; result required; follow-up false |
| IN_PROGRESS | CANCELLED | S/A; nonblank cancellation reason |
| COMPLETED / CANCELLED | None | Read-only terminal record |

Description/date/result/follow-up/attachment notes/assignee may be edited while PLANNED/IN_PROGRESS. Status plus fields can be saved atomically in one PATCH. Cancellation retains any previous result/follow-up information for history; cancelled follow-up does not block ticket resolution.

### Dashboard metric definitions

All ticket counts count distinct tickets, not joined action rows. All actions on requester-owned tickets are shared; internal notes remain private.

| Key / visible label | Exact predicate and calculation | Drill-down |
| --- | --- | --- |
| R.open / Open tickets | Own tickets in active set | `/tickets?dashboardFilter=open` |
| R.waiting / Waiting for you | Own tickets with WAITING_FOR_REQUESTER | `/tickets?dashboardFilter=waiting` |
| R.recentlyResolved / Recently resolved | Own current RESOLVED/CLOSED, resolvedAt in recent window | `/tickets?dashboardFilter=recentlyResolved&from=...&to=...` |
| R.recentlyUpdated / Recently updated | Own updatedAt in recent window; count plus newest five | `/tickets?dashboardFilter=recentlyUpdated&from=...&to=...` |
| S.unassigned / Unassigned tickets | Active tickets with ticketOwnerId null | `/queue?dashboardFilter=unassigned` |
| S.ownedByMe / My active tickets | Active tickets with ticketOwnerId=session user | `/queue?dashboardFilter=ownedByMe` |
| S.byStatus / Tickets by status | All tickets grouped into all eight statuses, including zeros | `/queue?status=ENUM` |
| S.byPriority / Active tickets by IT priority | Active tickets grouped LOW/MEDIUM/HIGH/CRITICAL, including zeros | `/queue?dashboardFilter=open&itPriority=ENUM` |
| S.myActions / My active actions | Action-active, assigneeId=session user, active parent ticket; count plus first five ordered actionAt ASC,id ASC | `/queue?dashboardFilter=myActions` (distinct parent tickets) |
| S.recentlyUpdated / Recently updated | All tickets updatedAt in window; count plus newest five | `/queue?dashboardFilter=recentlyUpdated&from=...&to=...` |

My active actions shows both `actionCount` and `ticketCount`; its queue link label is “View N related tickets”, so multiple actions on one ticket do not imply equal counts. Individual action links open `/tickets/:id#action-:actionId`. No optional administrator account-count dashboard is included. Each ticket list item links to the authorized Ticket Detail.

## 6. UI Specification Summary

See [ui-spec.md](ui-spec.md). Add `/dashboard` as the authenticated home: requester view for REQUESTER, staff view for IT_STAFF/ADMINISTRATOR. Keep My Tickets/Create Ticket, Queue, Admin Users, account-help, Change Password and Logout available according to their existing role rules. Ticket Detail gains shared Actions Taken with list/create/view/edit modes and workflow history. Requesters have no action editor. Staff status controls show permitted edges and explain the resolution gate; successful writes refresh summary, version and dependent dashboard data. Forms preserve drafts on validation/network/conflict failures and never silently resubmit stale changes.

## 7. Data Changes

### Proposed additive models and fields

| Model | Fields / constraints |
| --- | --- |
| ActionTaken | `id Int PK`, `ticketId Int FK`, `actionAt DateTime @db.Timestamptz(3)`, `description String`, `result String?`, `performedById Int FK`, `assigneeId Int FK`, `followUpRequired Boolean default false`, `followUpNote String?`, `attachmentNotes String?`, `status ActionStatus default PLANNED`, `cancellationReason String?`, `version Int default 1`, `updatedById Int FK`, `createdAt/updatedAt DateTime @db.Timestamptz(3)`, `idempotencyKey String UUID`, `requestFingerprint String` |
| ActionRevision | `id Int PK`, `actionId FK`, `version Int`, `editorId FK`, `eventType CREATE/EDIT/STATUS`, `snapshot Json` (allowlisted action business fields and identities, no secrets), `createdAt timestamptz`; unique `(actionId,version)`; append-only |
| TicketWorkflowEvent | `id Int PK`, `ticketId FK`, `actorId FK`, `kind OWNER/PRIORITY/STATUS/REQUESTER_INDICATION`, `before Json`, `after Json` (allowlisted changed public values only), `createdAt timestamptz`; append-only |
| Ticket extensions | `version Int default 1`, `resolvedAt DateTime? @db.Timestamptz(3)`, `reopenedAt DateTime? @db.Timestamptz(3)`, `resolutionTimeEstimated Boolean default false` |
| ActionStatus enum | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED |

Foreign keys use restrictive deletion for historical parent/actor references; user deactivation does not delete history. Add `(ticketId,actionAt,id)`, `(assigneeId,status,actionAt,id)` and unique `(performedById,ticketId,idempotencyKey)` to actions; `(actionId,createdAt,id)` to revisions; `(ticketId,createdAt,id)` to events; ticket indexes `(requesterId,currentStatus)`, `(requesterId,updatedAt,id)`, `(currentStatus,resolvedAt,id)`, `(updatedAt,id)` and `(ticketOwnerId,currentStatus)` after checking overlapping existing indexes. Validate string lengths server-side; migration constraints enforce positive versions and required parent/actor references.

### Design justifications

1. Separate performer and assignee avoids confusing historical authorship with planned responsibility; restricted foreign keys preserve attribution after deactivation.
2. Integer versions and a shared parent transactional guard protect cross-record resolution invariants; action-only locking would permit a new pending action to race with resolution.
3. Current action snapshots plus append-only revisions support practical editing without losing audit evidence. No fabricated historical events are backfilled.
4. Aggregate queries plus selective indexes avoid downloading whole ticket collections or multiplying counts through action joins.

### Migration, backfill and recovery

1. Before implementation, capture baseline build/test results. Back up PostgreSQL and attachment storage together; record row counts, ticket/requester/owner IDs, hashes of representative attachment files, and restore commands for the local environment.
2. Apply version-controlled additive Prisma SQL migrations on a copy of a populated Lab 3 database. Never use `migrate reset`, drop existing tables or rewrite old migration history.
3. Existing tickets get version 1; no actions/revisions/events are fabricated. For existing RESOLVED/CLOSED tickets set resolvedAt to existing updatedAt and `resolutionTimeEstimated=true`; display this estimate and include it in recently-resolved metrics using that documented timestamp. All other resolvedAt values and legacy reopenedAt are null. A newly recorded resolution sets estimated=false.
4. Existing timestamp columns remain unchanged; interpret their existing UTC convention explicitly. New timestamptz columns normalize ISO inputs to UTC. Do not reinterpret UTC historical dates as Bangkok wall times.
5. Compare every earlier table count and key relationship, user login/hash continuity, attachment metadata/content, public comments and internal notes after migration. Run migration/regression tests and exact dashboard queries.
6. Recovery drill on a disposable copy: restore database plus files into a separate environment, run the pre-migration application and verify counts, login and download. Avoid destructive down-migrations in a live database; after new writes, back up again and prefer a forward repair to avoid losing post-migration work. Record actual commands/output and recovery duration.

### Seed acceptance

Use stable lab4-specific ticket numbers and action keys; only insert missing fixtures. Never reset real/previously edited seed accounts on repeated seed. Provide at least two active requesters (one with no tickets), two active staff, one inactive staff and an administrator; all eight ticket statuses and four priorities; assigned/unassigned tickets; zero/one/multiple actions, all action statuses, multiple performers on one ticket, follow-up blocking cases, inactive historical assignee, same-time ordering ties, legacy tickets, and records exactly at/just outside date boundaries. Fixed-clock test fixtures are separate from local demonstration seed. Test two consecutive seeds for identical counts, ownership and passwords; verify both zero and nonzero dashboard states.

## 8. API Contract

See [api-spec.md](api-spec.md) for exact DTOs, validation and error codes. New routes: ticket action collection/detail/history, shared ticket workflow history, requester/staff dashboards. Existing owner/priority/status/advisory writes gain expected versions; existing list endpoints gain dashboard filters. No previous approved route is removed. New protected routes apply active-account, mandatory-password-change, role and ownership guards. Public health remains safe and does not disclose secrets. Client proxy continues targeting backend port 3001.

## 9. Acceptance Criteria

Each criterion maps to tests in [tests.md](tests.md); test status remains Planned until actually executed.

| ID | Observable acceptance criterion |
| --- | --- |
| AC-01 | Given staff/admin and a valid action, POST creates one action on the specified ticket with immutable authenticated performer, default/selected active assignee and revision 1, without changing Ticket Owner. |
| AC-02 | Given missing/blank/oversized text, invalid dates/booleans or forged fields, save fails safely with field errors and no partial writes. |
| AC-03 | Given follow-up=true, blank note is rejected; completion requires result and follow-up=false; cancellation requires reason. |
| AC-04 | Given another active eligible assignee, assignment succeeds; requester/inactive assignees fail, including a user deactivated between form load and save. |
| AC-05 | Given own ticket, requester reads all actions/history but cannot create/edit/transition; another requester's ticket and internal notes remain inaccessible. |
| AC-06 | Given an active action/ticket, valid edit and action matrix edges persist with revisions; illegal edges, terminal edits/deletion and reparenting fail. |
| AC-07 | Given equal timestamps and multiple pages, actions/comments/notes/history retain deterministic ordering; earlier entries cannot be edited/deleted. |
| AC-08 | Given each ticket status and each role, all allowed edges and no others succeed; requester reopening is ownership restricted and requester indication is advisory. |
| AC-09 | Given a ticket eligible for resolution, only staff/admin can resolve it when every gate condition holds; each failed condition returns 409 even via direct API. |
| AC-10 | Given a resolved/closed ticket reopened, timestamps change as specified and fresh completed work is required for re-resolution; cancellation refuses active actions. |
| AC-11 | Given simultaneous action updates, or resolution racing an action change/create, exactly one incompatible write succeeds; loser receives conflict and no history/state is lost. |
| AC-12 | Given a repeated action creation key and equivalent payload, one action/revision exists; altered payload conflicts; repeated clicks/retries do not duplicate work. |
| AC-13 | Given requester A and B data, A's dashboard counts, previews and drill-down contain only A's tickets; empty owner yields zero/empty values. |
| AC-14 | Given staff/admin, dashboard unassigned/mine/status/priority/recent counts and current-user action/ticket counts equal authoritative queries, with all zero buckets present. |
| AC-15 | Given frozen Bangkok date boundaries, recent metrics apply inclusive from/exclusive to and documented legacy estimated resolution times exactly. |
| AC-16 | Given a dashboard link, its filtered list total matches the metric definition, supports reload/back navigation and never expands user scope; my-action count is distinguished from parent-ticket count. |
| AC-17 | Given any role, home/navigation opens its correct dashboard and preserves all existing permitted routes; unauthenticated and mandatory-change sessions are routed safely. |
| AC-18 | Given action create/edit/view and ticket workflow UI, controls, validation, read-only identity, success refresh, terminal restrictions and requester visibility match the contract. |
| AC-19 | Given loading/empty/forbidden/404/409/500/network failure, all new screens show the specified safe feedback; drafts survive recoverable failures and stale writes require explicit reconciliation. |
| AC-20 | Given desktop/tablet/mobile, new screens use Zen Green, readable badges, distinct shared/private areas and editable/read-only states with no clipping, overlap or page overflow. |
| AC-21 | Given keyboard-only and assistive-technology checks, every new control has a label, visible focus and usable order; errors/status updates are announced and dialogs return focus. |
| AC-22 | Given a populated Lab 3 database, migration preserves prior users/tickets/attachments/comments/notes; legacy rules work and a separate restore drill succeeds. |
| AC-23 | Given clean and already-seeded databases, two seed runs preserve existing changes and produce stable fixture counts covering all required cases. |
| AC-24 | Given complete Labs 1-4 suites, auth/session/password/admin safeguards, requester/queue/attachment/comment/note and health/proxy behavior pass without obsolete bypass fixtures or hidden failures. |
| AC-25 | Given the documented performance fixture, bounded dashboard responses and indexed queries meet the local performance-smoke budget without N+1 calls or full collections. |
| AC-26 | Given final release review, requirements/tests/evidence are linked, README and ignore rules are current, real peer approvals exist, and staged/main verification and all nine submission parts are complete. |

### Source coverage map

| Handout section / pages | Contract coverage | Acceptance |
| --- | --- | --- |
| 1-3, pp.1-2: product value and stakeholder | Sections 1-3; FR-01..20 | AC-01..26 |
| 4.1-4.4, pp.2-3: action fields and roles | BR-01..09, BR-25; UI/API contracts | AC-01..07 |
| 4.5, p.3; 6.1, p.4: ticket/resolution/conflicts | Both matrices, BR-10..19 | AC-08..12 |
| 4.6, p.3; 6.2, p.4: metrics/time/drill-down | Dashboard definitions, BR-20..24, BR-28 | AC-13..16, AC-25 |
| 5.1-5.3, pp.4: model/migration/seed/recovery | Section 7 and design justifications | AC-22..23 |
| 6, p.4: REST and continued APIs | Section 8 and api-spec | AC-01..16, AC-24 |
| 7-8.4, pp.4-6: shell/screens/workflow | FR-14..17 and ui-spec | AC-17..21 |
| 8.5-8.6, p.7: hardening/accessibility | BR-26..27, FR-16..20 | AC-19..25 |
| 9-10, pp.7-8: eleven sections/test levels | This structure and tests.md | AC-26 plus full AC traceability |
| 11-13, pp.8-10: issues/workflow/tree/DoD | Section 10, issues/reviewer/ai-use | AC-26 |
| 14 Part 5, p.10: current-user actions | S.myActions and staff dashboard | AC-14, AC-16 |
| 14 Part 6, p.11: assign/complete/cancel/inactive | Explicit action lifecycle/assignment | AC-03..06, AC-18 |
| 14 Part 7, p.11: append-only/stable/visibility | BR-15..16 shared history plus private notes | AC-05, AC-07..08 |
| 14 Parts 1-9, pp.10-11: final evidence | submission-checklist.md, DoD | AC-26 |

## 10. Definition of Done

### Product completion gate

- [ ] Approved engineering contract predates main implementation PR completion; all 26 ACs have actual passing tests and evidence.
- [ ] Action fields, assignment/lifecycle, shared visibility, audit history, ticket matrix/gates, idempotency and concurrency are implemented server-side and in UI.
- [ ] Both dashboards and matching drill-downs pass independent database reconciliation, date-boundary and empty-state checks.
- [ ] Migration, repeat seed, legacy data preservation and separate recovery drill pass; no destructive reset used as migration evidence.
- [ ] Full unit, API/integration, UI, style, authorization, workflow, migration/regression, performance and E2E suites pass; no unexplained skip, collection failure or known regression remains.
- [ ] Authentication, password change, account-help, session return, admin safety and attachment privacy remain correct; no exposed secrets or raw errors.
- [ ] Desktop/tablet/mobile and keyboard/accessibility checklists completed with actual screenshots; no unfinished placeholders, broken links, console errors or obsolete requester selector.
- [ ] README documents setup, environment variable names without secrets, migrations, non-destructive seed, test commands, local-only demo accounts and a reproducible role-based demo.
- [ ] `.gitignore` excludes secrets, node_modules, uploads containing user data and transient test output; intended sanitized evidence is retained deliberately.

### Sprint development Git workflow (future operations only)

Owner authorization on 5 October 2026: create issues for Features 18-24, commit/push all engineering documents on `feature18/lab04-spec`, then start `feature19/actions-taken-foundation` locally without committing/pushing it. The owner will review and merge Feature 18 into staging first. Remaining release operations require their own authorization. The exact Feature 18/19 names supersede the generic `feature/*` naming examples below.

Feature 19 starts from the current `lab04-staging` commit, not from the unmerged Feature 18 branch. Keep access to the published contract through `git show feature18/lab04-spec:docs/lab-04/<file>`. After the owner merges Feature 18, preserve local Feature 19 changes, update its base from staging safely and restore the local changes; resolve any contract changes before its first commit. Do not commit a temporary checkpoint or merge Feature 18 yourself to bypass the hold.

```text
Branch creation: main -> lab04-staging -> feature/<logical-number>-<scope>
Integration:     feature/* --reviewed PR--> lab04-staging --release PR--> main
```

1. Inspect clean/dirty status and preserve local changes. Fetch origin; update main by fast-forward only. Verify main contains the accepted Lab 3 increment. If it does not, stop for owner direction rather than rewriting history.
2. Create `lab04-staging` from that up-to-date main once (or safely fast-forward the existing staging branch after checking divergence). Never create feature branches from stale main or another unmerged feature branch.
3. Complete logical feature 18 contract review first. For each later issue, update `lab04-staging`, create its named feature branch from staging, and implement only after dependencies are integrated.
4. Follow Spec DD -> planned tests -> observed failing tests -> minimal implementation -> refactor -> targeted plus regression tests. Record genuine red/green evidence; don't invent earlier test results.
5. Make modular Conventional Commits, e.g. `feat(#<actual-issue-number>): add actions taken API`, `test(#...): cover stale action updates`, `docs(#...): define dashboard metrics`. Actual issue numbers come from GitHub after owner-authorized creation, not logical feature numbers.
6. When separately authorized, push the feature and open its PR **into lab04-staging**, linking the actual issue, AC IDs, test output, screenshots/migration risks and review request. No direct feature-to-main PR.
7. Peer reviewer checks contract, code, tests, security and visual evidence. Record identity, comments, author response, fix commits and approval in reviewer.md. Author addresses feedback before authorized integration; do not self-invent peer approval.
8. After approved feature integration, rerun staging checks before beginning dependent work. Use merge commits for visible feature topology; no history rewriting/force-push merely to beautify the graph.
9. After feature 24 release gates, obtain explicit authorization for release PR `lab04-staging -> main`, review and merge. Run the complete suite on the resulting main SHA and capture final evidence. Failed main validation blocks release completion.
10. Kanban: Backlog -> Specified -> Started -> PR Review -> Fixing (if required) -> PR Review -> Done. Feature Done requires reviewed integration and passing checks; release Done also requires final-main evidence.

| Logical feature | Branch created from lab04-staging | Prerequisites integrated | PR base |
| --- | --- | --- | --- |
| 18 Contract | `feature18/lab04-spec` | Approved Lab 3 main | lab04-staging |
| 19 Action foundation | `feature19/actions-taken-foundation` | 18 | lab04-staging |
| 20 Action UI | `feature/20-actions-taken-ui` | 19 | lab04-staging |
| 21 Ticket workflow | `feature/21-ticket-workflow` | 19, 20 | lab04-staging |
| 22 Requester dashboard | `feature/22-requester-dashboard` | 21 | lab04-staging |
| 23 Staff dashboard | `feature/23-staff-dashboard` | 22 | lab04-staging |
| 24 Final hardening/release | `feature/24-lab4-hardening-release` | 18-23 | lab04-staging; separate release PR to main |

### Course evidence completion gate

- [ ] All real issues linked on Project/Kanban, Done only when genuinely complete.
- [ ] reviewer.md contains actual independent reviews/responses/approvals and working PR links.
- [ ] ai-use.md names known LLM/tool identity and 6-10 actual selected prompts plus student's own reflection.
- [ ] Final commit graph, directory tree, README/ignore evidence and all rendered engineering documents captured.
- [ ] Exactly one concise PDF uses Answer Part 1 through Answer Part 9 in order, readable screenshots and working links, as listed in submission-checklist.md.

## 11. Assumptions and Decisions

These resolve omissions in the handout; they are **proposed contract decisions**, not quotations or completed implementation.

1. Section 14 explicitly grades action assignment/lifecycle although earlier field lists omit assignee/status. Include both and the four-state action matrix. The example AC's creator and assignee become separate fields.
2. The handout requires a resolution gate but leaves its expression open. Adopt completed work + no unfinished actions/follow-up + active owner, with fresh work after reopening (BR-11..13). Owner approval is required before coding this policy.
3. Section 14 requests append-only behavior while section 8.3 requires action editing. Interpret append-only as immutable revisions/workflow events and unchanged comment/note rules, not a ban on editing active action snapshots.
4. Section 8.3 says requesters see all actions. This is the selected permission, not the optional restricted interpretation suggested earlier in section 4.3. Warn staff that action text/history is shared; confidential work belongs in Internal Notes.
5. Assignment means responsibility, not delegation permissions: any active staff/admin can edit accessible open actions; author-only editing is not introduced. Performed-by remains the recorded creator.
6. Legacy resolution timestamps are unknown. Use explicit estimated updatedAt backfill, expose the estimate, and never present it as an exact historical resolution event.
7. Seven-day Bangkok window, field lengths, terminal action immutability, transaction/version design and performance targets are local engineering choices. Keep all documents/tests synchronized if approved choices change.
8. Use `lab04-staging` exactly as requested by the owner; document the difference from the PDF example `lab4-staging` in final report evidence.
9. Existing Lab 3 documentation contains stale UI examples (manual admin passwords, staff Create Ticket). Preserve actual safer behavior: server-generated temporary passwords and requester-only Create Ticket. Do not restore obsolete behaviors while extending the UI.
10. Historical Lab 3 test records report legacy-suite failures. They are not re-tested by this documentation task. Feature 24 must reproduce, fix and prove complete regression, not treat prior focused passes as certification.
11. The handout dashboard illustrations are design references, not additional fixed metric formulas: section 4.6 explicitly delegates exact calculations to the engineering contract. Do not copy illustrative daily trends or staff Create Ticket buttons into the approved scope; retain the requester-only creation policy and the metrics defined here.
