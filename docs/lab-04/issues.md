# Lab 4 GitHub Issue Drafts

**Published issues, 5 October 2026.** The owner authorized issue creation and Feature 18 commit/push. Feature 19 may start locally but remains uncommitted and unpushed until the owner verifies and merges Feature 18 into staging. No merge is authorized for the agent.

| Logical feature | Actual GitHub issue |
| --- | --- |
| 18 | [#40](https://github.com/N0M3KM/TokTickIT/issues/40) |
| 19 | [#41](https://github.com/N0M3KM/TokTickIT/issues/41) |
| 20 | [#42](https://github.com/N0M3KM/TokTickIT/issues/42) |
| 21 | [#43](https://github.com/N0M3KM/TokTickIT/issues/43) |
| 22 | [#44](https://github.com/N0M3KM/TokTickIT/issues/44) |
| 23 | [#45](https://github.com/N0M3KM/TokTickIT/issues/45) |
| 24 | [#46](https://github.com/N0M3KM/TokTickIT/issues/46) |

Template follows existing [Issue 12 / GitHub #27](https://github.com/N0M3KM/TokTickIT/issues/27), [Issue 15 / GitHub #30](https://github.com/N0M3KM/TokTickIT/issues/30), and [Issue 17 / GitHub #32](https://github.com/N0M3KM/TokTickIT/issues/32): title, Type, Branch, Acceptance criteria. Dependency and evidence notes make the future coding tasks self-contained. All branches originate from updated `lab04-staging`, not another feature branch; all feature PRs target `lab04-staging`.

## Issue #18: Sprint specification, test plan, UI spec, and API spec (Lab 4)

Type: Documentation

Branch: `feature18/lab04-spec`

Acceptance criteria:

- [ ] `docs/lab-04/specification.md` contains all eleven required sections, FR-01..20, BR-01..28, AC-01..26, both transition matrices, resolution gate, dashboard formulas, migration/recovery, seed and Product DoD.
- [ ] The owner reviews proposed decisions: assignment/performed-by distinction, action lifecycle, append-only revisions, exact resolution/reopen rules, timestamp estimates and dashboard time window.
- [ ] `tests.md` maps every AC to planned cases at all required levels, expected outcomes, proposed test-file paths and honest final status.
- [ ] `ui-spec.md` defines dashboards, Actions Taken list/create/view/edit, workflow feedback, responsive/accessibility and complete state/screenshot checklists.
- [ ] `api-spec.md` specifies endpoints/DTOs, validation, roles/ownership, safe errors, idempotency, shared-parent concurrency and drill-down parameters.
- [ ] `reviewer.md`, `ai-use.md`, `submission-checklist.md`, issue drafts and document index exist without fabricated evidence.
- [ ] Branch workflow is `main -> lab04-staging -> feature/*`; baseline Lab 3 main is verified before branch creation. Draft naming deviation from handout's `lab4-staging` is documented.
- [ ] Cross-document review passes before main implementation PRs are completed; actual specification commit/PR timestamps are retained as evidence after authorization.

Dependencies: Accepted Lab 3 increment on main; owner authorization for publishing this draft.

Verification: DOC-01 documentation portion; AC-26 engineering-contract evidence.

## Issue #19: Actions Taken foundation (migration, seed, APIs, authorization, and concurrency)

Type: Feature

Branch: `feature19/actions-taken-foundation`

Acceptance criteria:

- [ ] Add ActionTaken, ActionRevision, action status enum, ticket version/resolution fields and required indexes/FKs with additive Prisma migration; preserve all previous data and files.
- [ ] Implement documented legacy resolution backfill/estimate and repeatable non-destructive seed covering all required statuses, priorities, owners, action counts and zero/nonzero metrics.
- [ ] Implement GET/POST `/api/tickets/:id/actions`, GET/PATCH `/api/tickets/:id/actions/:actionId`, GET action history with exact DTOs and stable pagination.
- [ ] Every action stores all required handout fields; performedBy is automatic immutable creator; assignee defaults to creator but may be another active staff/admin without changing Ticket Owner.
- [ ] Enforce action PLANNED/IN_PROGRESS/COMPLETED/CANCELLED matrix, required result/follow-up/cancel fields, inactive-assignee rejection and terminal-parent restrictions server-side.
- [ ] Requesters read all actions on owned tickets only; requester writes, forged identities, wrong parent and unauthorized histories are rejected without leaking internal notes.
- [ ] Atomic snapshot/revision writes, integer versions/shared-parent guard and action-create idempotency pass true DB race/retry/rollback tests.
- [ ] Introduce expected versions on existing owner/priority/status/advisory writes and update their existing client callers in this same feature, keeping staging usable; ticket workflow audit/gate is completed in feature21.
- [ ] Migration on populated copy, two seed runs and separate DB/files recovery drill pass with actual counts/hash/relationship evidence.
- [ ] UNIT-01..02, UNIT-07, API-01..07, applicable SEC-01..05 and MIG-01..03 pass; current Lab 3 targeted regressions pass. Cover AC-01..07, AC-11..12, AC-22..23.

Dependencies: 18 integrated. Use specification section7 and API sections1-4; do not implement unapproved product features.

Evidence: Schema/migration, real API tests, concurrency outcome/history counts, migration/seed/recovery logs; no production credentials or copied private DBs.

## Issue #20: Actions Taken UI (list, create, assign, edit, complete, and cancel)

Type: Feature

Branch: `feature/20-actions-taken-ui`

Acceptance criteria:

- [ ] Extend active `client/src/main.tsx` application's Ticket Detail with all-action list, create, view/edit and revision-history views; do not implement only an unused legacy App component.
- [ ] Show date/time, description, result, read-only performer, active assignee, status, follow-up flag/note and attachment notes; multiple staff may record actions on one ticket.
- [ ] Support assignment, Start, Complete and Cancel action with conditional result/follow-up/reason validation and explicit distinction from Cancel editing.
- [ ] Requester sees all owned ticket action items and history without mutation controls; private notes stay hidden and terminal states are read-only.
- [ ] Keep drafts after safe failures/conflicts, disable duplicate submission and retry with the same idempotency key; require explicit stale reconciliation/discard.
- [ ] Preserve stable order/pagination and direct dashboard action anchors even when an action is not on the first page.
- [ ] Use Zen Green/read-only/shared-content cues and accessible desktop/tablet/mobile layouts; all loading/empty/validation/success/forbidden/not-found/conflict/failure states work.
- [ ] UI-02..04, UI-08 and E2E-01 pass; feature-scoped STYLE-01, RESP-01 and A11Y-01 pass. Relevant AC-01..07, AC-12, AC-18..21 demonstrated with real API persistence.

Dependencies: 19 integrated.

Evidence: `ActionsTaken.test.tsx`, `actions-taken-flow.spec.ts`, screenshots in `artifacts/lab-04/screenshots/actions-taken/`, real requester/staff role checks.

## Issue #21: Final Ticket workflow (resolution gate, transitions, audit history, and safe conflicts)

Type: Feature

Branch: `feature/21-ticket-workflow`

Acceptance criteria:

- [ ] Enforce every approved edge/role in the eight-state ticket matrix; requester reopening is limited to owned RESOLVED/CLOSED tickets.
- [ ] Direct resolution API calls require eligible active owner, completed work, no active actions or outstanding non-cancelled follow-up; requester advisory is never formal resolution.
- [ ] Reopening clears resolvedAt, sets reopenedAt and requires fresh completed action before re-resolution. Legacy already-resolved tickets stay valid and may close without fabricated work.
- [ ] Ticket cancellation refuses active actions and does not silently cascade completion/cancellation.
- [ ] Implement append-only TicketWorkflowEvent and GET `/api/tickets/:id/history`; owner/priority/status/advisory changes and their events are atomic and shared safely.
- [ ] Resolve versus concurrent action create/edit cannot violate the cross-record gate; stale writes return409 with safe reconciliation behavior.
- [ ] Ticket UI exposes only permitted transitions, actionable gate reasons, refreshed summary/history and requester advisory wording; stable comments/notes/history ordering retained.
- [ ] UNIT-03..04, API-08..11, API-18, UI-05, E2E-02 and E2E-04 conflict portion pass; AC-07..11, AC-18..19 covered.

Dependencies: 19 and20 integrated.

Evidence: `ticket-workflow.api.test.ts`, `TicketWorkflow.test.tsx`, `ticket-resolution.spec.ts`, DB race assertions and workflow screenshots.

## Issue #22: Requester Dashboard (owned metrics, recent tickets, and drill-down)

Type: Feature

Branch: `feature/22-requester-dashboard`

Acceptance criteria:

- [ ] GET `/api/dashboards/requester` returns only session-requester data: open, waiting-for-you, recently-resolved and recently-updated counts; bounded recent/resolved previews and snapshot/window metadata.
- [ ] Counts come from authoritative backend queries; exact active set, seven-day Bangkok boundaries and estimated legacy resolution behavior are implemented and independently tested.
- [ ] Extend My Tickets API/UI with documented dashboardFilter/from/to predicates, consistent total/sort, URL persistence and safe reload/back behavior.
- [ ] Create requester `/dashboard` and navigation/default home while preserving safe redirectAfterLogin, mandatory password change, My Tickets/Create Ticket/detail and Logout.
- [ ] All card/list links work; zero/empty/loading/forbidden/not-found/network states are clear; no caller-selected requester identity or cross-account stale cache.
- [ ] UNIT-05..06/08 requester portions, API-12/14/15, UI-01/06 and E2E-03 requester flow pass; scoped responsive/style/accessibility pass. AC-13, AC-15..17, AC-19..21 covered.

Dependencies: 21 integrated. Shared `/dashboard` route must preserve staff/admin existing landing until feature23 is integrated, not expose a blank placeholder.

Evidence: `requester-dashboard.api.test.ts`, `RequesterDashboard.test.tsx`, database-to-card reconciliation and requester-dashboard screenshots at all three viewports.

## Issue #23: IT Staff and Administrator Dashboard (operational metrics and current-user actions)

Type: Feature

Branch: `feature/23-staff-dashboard`

Acceptance criteria:

- [ ] GET `/api/dashboards/staff` serves S/A only; administrator reuses staff scope.
- [ ] Display active unassigned tickets, my active tickets, all eight status buckets, active IT-priority buckets, recently-updated tickets and current-user assigned active actions.
- [ ] My actions returns bounded items, actionCount and distinct parent ticketCount; links correctly distinguish action detail from filtered parent-ticket queue.
- [ ] Extend queue dashboardFilter predicates and stable sorts; backend aggregation and drill-down totals match independent DB queries without join inflation.
- [ ] Use exact snapshot/timezone/recent-window calculations, all zero buckets and bounded safe DTOs; no internal notes, secrets or full collections.
- [ ] Staff/admin Dashboard becomes correct home/nav and all existing queue/detail/admin/password/logout flows remain available.
- [ ] UI-07, API-13/16, remaining UNIT-05/06/08 and E2E-03 role flow pass; relevant security, style, responsive and accessibility cases pass. AC-14..17, AC-19..21 covered.
- [ ] PERF-01 passes for both dashboard endpoints with environment and p95/payload/query evidence, AC-25.

Dependencies: 22 integrated.

Evidence: `staff-dashboard.api.test.ts`, `StaffDashboard.test.tsx`, `dashboards.spec.ts`, independent metric queries, current-user action screenshots and performance log.

## Issue #24: Final regression, accessibility, visual inspection, and release integration

Type: Release

Branch: `feature/24-lab4-hardening-release`

Acceptance criteria:

- [ ] All AC-01..26 implemented and mapped to actual tests; all mandatory tests across Labs1-4 pass with no hidden skip, collection failure or known regression.
- [ ] Repair outdated legacy fixtures without deleting assertions or bypassing auth; prove full login/logout/password/admin/ownership/queue/comment/note/attachment/health/proxy regression.
- [ ] Complete E2E-01..05, REG-01..04, STYLE-01, RESP-01, A11Y-01, PERF-01 and DOC-01, plus all prior feature tests.
- [ ] Verify real migration/data preservation, two seed runs and recovery; record exact commands, environment, SHA and pass/fail counts.
- [ ] Capture desktop/tablet/mobile major-screen screenshots and loading/empty/validation/forbidden/conflict/failure states; complete visual/accessibility checklist, including keyboard/contrast/zoom/overflow.
- [ ] Remove obsolete/duplicate UI, placeholders, broken links and console errors; forms preserve recoverable drafts and retries do not duplicate writes.
- [ ] Update README setup/migration/seed/local-only demo/test/demo instructions and verify ignore rules; keep screenshots/logs sanitized and no real secrets.
- [ ] Complete real reviewer identities/comments/responses/approvals; ai-use has6-10 actual prompts and student's reflection, never invented future evidence.
- [ ] After separately authorized feature review/integration, open release PR `lab04-staging -> main`; obtain peer approval and explicit merge authorization. Verify all required suites again on resulting main SHA.
- [ ] Move actual issues to Done only after completion; assemble exactly one concise PDF with Answer Part1..9 in order and working evidence links per submission-checklist.md.

Dependencies: 18-23 integrated. Release/merge steps are future gates, not authorization to execute them now.

Evidence: Final-main test logs, all AC links, commit graph, Kanban, rendered markdowns, reviewer/AI records and9-part report.

## Suggested issue sequence and Kanban

18 ->19 ->20 ->21 ->22 ->23 ->24. Use Backlog -> Specified -> Started -> PR Review -> Fixing (if needed) -> PR Review -> Done. Each task should link its actual GitHub issue number once created. Do not use logical `#18` in a GitHub closing keyword unless GitHub actually assigns that number.
