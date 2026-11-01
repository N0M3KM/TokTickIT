# Lab 4 Final Submission Checklist

**Planning artifact only.** Source: handout section 14, pages 10-11. Final deliverable is exactly one concise PDF, total 60 points, with headings **Answer Part 1 through Answer Part 9** in this exact order. Repository and final main remain authoritative. Include working links and readable screenshots without extreme zoom. Do not claim completed evidence while features remain unimplemented.

## Answer Part 1: Git Use with Engineering Workflow (10 points)

- [ ] Commit graph shows feature PRs integrated into `lab04-staging`, followed by reviewed release to main; explain user-selected spelling versus handout's `lab4-staging` example.
- [ ] Link repository, final main SHA, real issues/PRs and Project/Kanban showing completed issues in Done.
- [ ] Render reviewer.md with actual reviewer identities, review comments, author responses, fixes and approvals.
- [ ] Show current README, `.gitignore` and required repository directory structure.
- [ ] [Insert Figure: reviewed feature/staging/main Git graph and final Kanban.]

## Answer Part 2: Spec DD (5 points)

- [ ] Link/render `docs/lab-04/specification.md` showing numbered FR/BR/AC, action/ticket matrices, resolution gate, dashboard calculations, migration decisions and Product DoD.
- [ ] Show actual specification commit/PR timestamps proving contract existed before main implementation PR completion.
- [ ] [Insert Figure: rendered specification and contract-history evidence.]

## Answer Part 3: Test DD and Traceability (10 points)

- [ ] Link/render tests.md with planned tests, all 26 AC mappings, actual implemented test-file paths and final results.
- [ ] Include complete unit, API/integration, UI, authorization, workflow, regression and E2E passing output from final main; also required style/responsive/migration/performance/accessibility evidence.
- [ ] Record commands, environment, final main SHA and pass/fail/skip counts; no placeholder test files or masked collection errors.
- [ ] [Insert Figure: rendered test plan and actual passing full-suite output.]

## Answer Part 4: AI Use with Reflection (5 points)

- [ ] Render ai-use.md naming known LLM/tool identity and 6-10 actual selected key prompts.
- [ ] Include student's brief “My Reflection” on specification-agent and coding-agent use; do not invent future interactions.
- [ ] [Insert Figure: rendered AI-use record.]

## Answer Part 5: Working IT Staff Dashboard UI (5 points)

- [ ] Approved operational metrics, current-user Actions Taken, recently updated tickets, accurate counts and drill-down.
- [ ] Loading, empty, forbidden, safe-failure and responsive states.
- [ ] Selected cards independently matched to database queries, with query/time bounds/results.
- [ ] [Insert Figures: staff/admin dashboard, my actions, filtered queue and database reconciliation.]

## Answer Part 6: Working Actions Taken UI (10 points)

- [ ] List/create/assign/edit/start/complete/cancel on one ticket with different actions and staff identities.
- [ ] Required validation, inactive-assignee rejection, requester read-only/other-owner denial, safe failure and responsive behavior.
- [ ] Draft preservation, retry/conflict and terminal restrictions; all required fields visible.
- [ ] [Insert Figures: action list/form, assignment, completion/cancellation, validation and role restrictions.]

## Answer Part 7: Working Ticket Workflow (5 points)

- [ ] Permitted transitions, resolution gate, advisory versus formal resolution, reopen and cancellation behavior.
- [ ] Stable ordering, append-only action revisions/workflow history/comments/notes and role-appropriate visibility.
- [ ] [Insert Figures: blocked/successful resolution, chronological history and requester visibility.]

## Answer Part 8: Working Requester Dashboard and Final Regression UI (5 points)

- [ ] Own-only counts, recent and attention-required tickets, exact drill-down and backend ownership protection.
- [ ] Representative authentication, My Tickets, Ticket Detail, attachments, public comments, staff operations, private notes and admin-user regression.
- [ ] [Insert Figures: requester dashboard/filter, ownership denial and representative Lab 1-3 regression screens.]

## Answer Part 9: Zen Green UI, Responsive, Accessibility, and Final Polish (5 points)

- [ ] Render ui-spec.md and completed visual/accessibility checklist.
- [ ] Desktop 1280x800, tablet 900x1024 and mobile 375x812 screenshots for both dashboards, action list/create/edit/view and ticket workflow.
- [ ] Editable/read-only cues, validation placement, keyboard focus, labels/contrast, private/shared distinction, no clipping/overlap/horizontal page overflow.
- [ ] [Insert Figures: responsive major-screen comparisons and keyboard/accessibility evidence.]

## Required repository increment to verify at release

```text
docs/lab-04/
  specification.md, tests.md, ui-spec.md, api-spec.md, reviewer.md, ai-use.md
  README.md, issues.md, submission-checklist.md
server/tests/lab-04/
  actions-taken.api.test.ts
  ticket-workflow.api.test.ts
  requester-dashboard.api.test.ts
  staff-dashboard.api.test.ts
  [additional planned unit/security/concurrency/migration/regression/performance files]
client/src/lab-04/
  StaffDashboard.test.tsx
  RequesterDashboard.test.tsx
  ActionsTaken.test.tsx
  TicketWorkflow.test.tsx
  [additional shell/style files]
e2e/lab-04/
  actions-taken-flow.spec.ts
  ticket-resolution.spec.ts
  dashboards.spec.ts
  [additional responsive/accessibility/regression files]
artifacts/lab-04/
  README.md
  screenshots/staff-dashboard/
  screenshots/requester-dashboard/
  screenshots/actions-taken/
  screenshots/ticket-workflow/
  test-results/
```

Only the Markdown documents are drafted in the current task. Tests, screenshot directories, logs, release evidence and final PDF above are **future deliverables**, not existing outputs. Before submission, verify every link resolves and every screenshot/result belongs to the reported commit and role.
