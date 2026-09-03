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

*(To be completed — record PRs reviewed on teammates' repositories)*

| Partner name | Partner GitHub username |
|-------------|------------------------|
| *(partner name)* | *(partner username)* |

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
