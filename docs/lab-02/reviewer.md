# Lab 2 — Peer Review Record

This document records the peer review activity for Lab 2 (Sprint 2) as required by the Definition of Done Part 2 and the course delivery requirements.

---

## My Reviewer

| Field | Details |
|-------|---------|
| All reviewer name | TauForge / Jinnakan |
| All reviewer GitHub username | @TauForge / @Jinnakan |

---

## Pull Request Links

| Issue | Branch | PR Title | PR Link | Status |
|-------|--------|----------|---------|--------|
| #5 — Specification and Instructions | `feature/5-specification-and-instruction` | Feature 5: Specification | https://github.com/N0M3KM/TokTickIT/pull/18 | ✅ Merged |
| #6 — Database Schema and Seed | `feature/6-lab2-database-schema` | Feature 6: Database schema | https://github.com/N0M3KM/TokTickIT/pull/19 | ✅ Merged |
| #7 — Reference Data and Dev Requester APIs | `feature/7-reference-data-api` | Feature 7: Reference Data API | https://github.com/N0M3KM/TokTickIT/pull/20 | ✅ Merged |
| #8 — Ticket and Attachment APIs | `feature/8-ticket-attachment-api` | Feature 8: Add ticket and attachment endpoints with validation and tests | https://github.com/N0M3KM/TokTickIT/pull/21 | ✅ Merged |
| #9 — Requester Selector UI and App Shell | `feature/9-requester-selector-ui` | Feature 9: Add Dev Requester Selection screen and application shell | https://github.com/N0M3KM/TokTickIT/pull/22 | ✅ Merged |
| #10 — Ticket Screens UI | `feature/10-ticket-screens-ui` | Feature 10: Add Create Ticket, My Tickets, Ticket Detail screens | https://github.com/N0M3KM/TokTickIT/pull/23 | ✅ Merged |
| #11 — E2E Tests and Release | `feature/11-e2e-and-release` | Feature 11: Add Playwright E2E and responsive tests | https://github.com/N0M3KM/TokTickIT/pull/24 | ✅ Merged |
| Release — lab2-staging to main | `lab2-staging` | Merging Lab2 staging to Main | https://github.com/N0M3KM/TokTickIT/pull/25 | ⏳ Open |

---

## Submitted Pull Requests Reviewed by My Peer

| Lab 2 Issue | Pull Request Link | Reviewer Approval Link |
|-------------|-------------------|----------------------|
| Feature 5: Specification — PR #18 | https://github.com/N0M3KM/TokTickIT/pull/18 | https://github.com/N0M3KM/TokTickIT/pull/18#pullrequestreview-5077758228 |
| Feature 7: Reference Data API — PR #20 | https://github.com/N0M3KM/TokTickIT/pull/20 | https://github.com/N0M3KM/TokTickIT/pull/20#pullrequestreview-5077758228 |
| Feature 8: Ticket/Attachment APIs — PR #21 | https://github.com/N0M3KM/TokTickIT/pull/21 | https://github.com/N0M3KM/TokTickIT/pull/21#pullrequestreview-5079148476 |
| Feature 9: Requester Selector UI — PR #22 | https://github.com/N0M3KM/TokTickIT/pull/22 | https://github.com/N0M3KM/TokTickIT/pull/22#pullrequestreview-5079148476 |
| Feature 10: Ticket Screens UI — PR #23 | https://github.com/N0M3KM/TokTickIT/pull/23 | https://github.com/N0M3KM/TokTickIT/pull/23#pullrequestreview-5079760317 |
| Feature 11: E2E Tests — PR #24 | https://github.com/N0M3KM/TokTickIT/pull/24 | https://github.com/N0M3KM/TokTickIT/pull/24#pullrequestreview-5079760317 |

---

## Feedback Received from My Reviewer

**Pull Request: Feature 6 — Database schema — PR #19**
(https://github.com/N0M3KM/TokTickIT/pull/19)

- **Reviewer (Jinnakan)'s comment:**
  > "AC-2 (migration) — structurally sound, additive, matches schema. AC-3 (seed) — correct counts, properly idempotent via upsert. AC-1 (schema matches spec) partial concern — relatedSystem is a FK in code but free-text in the spec (spec itself is self-contradictory here, code is arguably more correct); none of the spec's length/size constraints (summary ≤200, sizeBytes ≤5.2MB, etc.) are enforced in the schema. Overall if schema spec is not critical, this work is already solid."

- **My response:**
  > "Thanks for the thorough review. relatedSystem as FK is intentional and traceable to specification.md §11 Decision #1. Length/size constraints are validated at the application layer (backend route validation in Issue #8) — Prisma doesn't natively support VARCHAR-length constraints on String fields. Happy to merge."

**Pull Request: Feature 7 — Reference Data API — PR #20**
(https://github.com/N0M3KM/TokTickIT/pull/20)

- **Reviewer (TauForge)'s comment:**
  > "Looks good to me. The API endpoints, sorting/filtering behavior, and test coverage all look good. Approved."

- **My response:**
  > Thank you for the review and verification of my work.

**Pull Request: Feature 9 — Requester Selection UI — PR #22**
(https://github.com/N0M3KM/TokTickIT/pull/22)

- **Reviewer (TauForge)'s comment:**
  > "Looks good to me. The requester selection flow, app shell, routing, and test coverage look solid."

- **My response:**
  > Thank you for the review and verification of my work.

**Pull Request: Feature 10 — Ticket Screens UI — PR #23**
(https://github.com/N0M3KM/TokTickIT/pull/23)

- **Reviewer (Jinnakan)'s comment:**
  > "You've built proper URL-based routing with react-router-dom (/tickets/:id etc.) — a real structural advantage over view-switching via component state (deep-linkable, browser back/forward works, refresh doesn't lose your place). Really good work."

- **My response:**
  > Thank you for the review and verification of my work.

---

## Peer Review I Gave to My Partner

### Partner 1: Jinnakan

| Field | Details |
|-------|---------|
| Partner name | Jinnakan |
| Partner GitHub username | @Jinnakan |

**My review comment on Jinnakan/TokTickIT PR #18 (Feature/6 — Lab 2 Schema & Seed):**
> "TicketStatus having only one value looks odd today, but it's deliberate (spec §7): Lab 3 can add ASSIGNED/RESOLVED/etc. via a plain migration without changing the column type. Category gets isActive added non-destructively (DEFAULT true), so your 4 existing seeded rows stay valid with no backfill needed. RelatedSystem / DevRequester — same shape as each other: unique natural key (name / email), isActive, indexed on isActive since that's the column every 'active only' query filters on. Ticket — three FKs (requesterId, categoryId, relatedSystemId), all ON DELETE RESTRICT. That means Postgres will refuse to delete a Category/RelatedSystem/DevRequester that any Ticket still references — which fits the soft-removal philosophy of this sprint (nothing gets hard-deleted anyway). ticketNumber is UNIQUE NOT NULL, which has one implication worth flagging now: since it's derived from the row's own id (BR-04) but can't be NULL even briefly, ticket creation in Issue 4 will need to insert with a temporary unique placeholder, then UPDATE it to the real TKT-YYYY-NNNNNN value once the id exists — same transaction, so no caller ever observes the placeholder. That's implementation work for Issue 4, not something the schema itself needs to change for. Attachment — ticketId FK also RESTRICT (a Ticket can never be deleted out from under its Attachments, consistent with no hard-delete anywhere in Lab 2). Compound index (ticketId, isRemoved) supports the common query 'active attachments for this ticket' without a full scan."

- Evidence link: https://github.com/Jinnakan/TokTickIT/pull/18

**My review comment on Jinnakan/TokTickIT PR #21 (Feature 8 — Create Ticket Form):**

- Inline code review on lines +174 to +193 and lines +267 to +269 regarding Category dropdown and form field implementation.
- Evidence link: https://github.com/Jinnakan/TokTickIT/pull/21#event-30340756559

**My review comment on Jinnakan/TokTickIT PR #22 (Feature — Add ticket rules, status, and stubAppFetch):**
> "Reaching three directories up across the client/server boundary couples the client bundler to the server's internal folder layout. It works today because ticket-rules.ts happens to be pure, but nothing stops someone from adding a Prisma or Node-only import to that file later and silently breaking (or bloating) the client build. This should be a shared package/workspace (e.g. packages/shared) that both sides depend on properly, not a relative reach-through. But if you have any reason, please let me acknowledge."

- Jinnakan's response: "You're right to flag this, and the critique is correct. I already suspected this risk when I made the call, but relied on no-duplicate code instead of a structural guarantee, which is exactly the gap you are pointing at. Nothing stops someone from adding a Prisma import to ticket-rules.ts later and silently breaking or bloating the client bundle. Fixing it properly with an npm workspace, as you suggested."
- My follow-up: "Cool! Everything seems good now."
- Evidence link: https://github.com/Jinnakan/TokTickIT/pull/22#event-30347114184

**My review comment on Jinnakan/TokTickIT PR #23 (Ticket Detail + Attachment Lifecycle):**
> "The code is clean. Everything seems to be functioning correctly. Nice job :)"

- Evidence link: https://github.com/Jinnakan/TokTickIT/pull/23

**My review comment on Jinnakan/TokTickIT PR #24 (Release Readiness):**
> "The pull request successfully aligns with the overarching issue criteria and repository standards. The implementation cleanly addresses the intended feature requirements while ensuring modularity and maintainable code layout. Control flow has been kept straightforward with readable naming conventions that communicate clear intent. Potential edge cases and state management are safely handled without introducing unnecessary code bloat or structural complexity. Overall, the contribution is well-formed, easy to review at a high level, and ready to be merged."

- Evidence link: https://github.com/Jinnakan/TokTickIT/pull/24#event-30353671525

---

### Partner 2: TauForge

| Field | Details |
|-------|---------|
| Partner name | TauForge |
| Partner GitHub username | @TauForge |

**My review comment on TauForge/TokTickIT PR #10 (Docs: Complete Lab 1 Submission Records):**

- Reviewed the Lab 1 submission records PR.
- Evidence link: https://github.com/TauForge/TokTickIT/pull/10

**My review comment on TauForge/TokTickIT PR #19 (Issue 1: Lab 2 Spec Docs):**
> "The code is clean. Everything seems to be functioning correctly. Excellent work :)"

- TauForge's response: "Thanks! This one's just the spec docs and test DB harness, so nothing risky. PR #2 (data model) is next once this merges."
- Evidence link: https://github.com/TauForge/TokTickIT/pull/19#event-30350926576

**My review comment on TauForge/TokTickIT PR #22 (Issue 4: Implement Ticket Creation):**

- Reviewed ticket creation implementation covering CreateTicket screen, client-side validation, and POST /api/tickets.
- Evidence link: https://github.com/TauForge/TokTickIT/pull/22#event-30353045355

**My review comment on TauForge/TokTickIT PR #23 (Issue 5: My Tickets List, Filter, Sort):**
> "LGTM Good job :)"

- TauForge's response: "LGTM Good job :) Thx for review you can merge"
- Evidence link: https://github.com/TauForge/TokTickIT/pull/23#issuecomment-5495722143

**My review comment on TauForge/TokTickIT PR #24 (Issue 6: Ticket Detail with Attachments):**

- Reviewed Ticket Detail implementation with full attachment lifecycle (upload, download, soft-remove).
- Evidence link: https://github.com/TauForge/TokTickIT/pull/24#issuecomment-5495912363

---

## Approval Records

| PR | Reviewer | Approval Date |
|----|----------|--------------|
| PR #18 — Feature 5 | TauForge | 2026-09-01 |
| PR #19 — Feature 6 | Jinnakan | 2026-09-01 |
| PR #20 — Feature 7 | TauForge | 2026-09-01 |
| PR #21 — Feature 8 | TauForge | 2026-09-01 |
| PR #22 — Feature 9 | TauForge | 2026-09-01 |
| PR #23 — Feature 10 | Jinnakan | 2026-09-01 |
| PR #24 — Feature 11 | Jinnakan | 2026-09-01 |

---

## Branch and Merge Flow

All feature branches were merged into `lab2-staging` via peer-reviewed Pull Requests. The final release PR merges `lab2-staging` → `main` after all issues are complete and all tests pass.

```
feature/5  → lab2-staging  (PR #18, approved by TauForge)
feature/6  → lab2-staging  (PR #19, approved by Jinnakan)
feature/7  → lab2-staging  (PR #20, approved by TauForge)
feature/8  → lab2-staging  (PR #21, approved by TauForge)
feature/9  → lab2-staging  (PR #22, approved by TauForge)
feature/10 → lab2-staging  (PR #23, approved by Jinnakan)
feature/11 → lab2-staging  (PR #24, approved by Jinnakan)
lab2-staging → main        (PR #25 — release PR, pending merge)
```
