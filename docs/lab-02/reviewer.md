# Lab 2 — Peer Review Record

This document records the peer review activity for Lab 2 (Sprint 2) as required by the Definition of Done Part 2 and the course delivery requirements.

---

## Reviewer Identity

| Role | Name | GitHub Username |
|------|------|-----------------|
| Author | *(your name)* | N0M3KM |
| Peer Reviewer | *(reviewer's name)* | *(reviewer's GitHub username)* |

---

## Pull Request Links

| Issue | Branch | PR Title | PR Link | Status |
|-------|--------|----------|---------|--------|
| #5 — Specification and Instructions | `feature/5-specification-and-instruction` | docs: add Lab 2 specification, test plan, UI spec, API spec, and implementation instructions | *(PR URL)* | ✅ Merged |
| #6 — Database Schema and Seed | `feature/6-lab2-database-schema` | feat(db): add Lab 2 schema increment, migration, and seed data | *(PR URL)* | ✅ Merged |
| #7 — Reference Data and Dev Requester APIs | `feature/7-reference-data-api` | feat(api): add reference data and dev requester endpoints | *(PR URL)* | ✅ Merged |
| #8 — Ticket and Attachment APIs | `feature/8-ticket-attachment-api` | feat(api): add ticket and attachment endpoints with validation and tests | *(PR URL)* | ✅ Merged |
| #9 — Requester Selector UI and App Shell | `feature/9-requester-selector-ui` | feat(ui): add Dev Requester Selection screen and application shell | *(PR URL)* | ✅ Merged |
| #10 — Ticket Screens UI | `feature/10-ticket-screens-ui` | feat(ui): add Create Ticket, My Tickets, Ticket Detail screens and shared components | *(PR URL)* | ✅ Merged |
| #11 — E2E Tests and Release | `feature/11-e2e-and-release` | feat(e2e): add Playwright E2E and responsive tests, reviewer and AI-use docs | *(PR URL)* | *(pending)* |

---

## Review Comments Given

*(To be completed by the author — record each comment you gave on a teammate's PR.)*

| PR | File / Line | Comment | Resolution |
|----|-------------|---------|------------|
| #6 — Teammate's DB schema | `server/prisma/schema.prisma` | *(example: "Suggest adding @@index on isActive for DevRequester for query performance")* | *(accepted / resolved)* |
| — | — | — | — |

---

## Review Comments Received

| PR | File / Line | Comment from Reviewer | My Response |
|----|-------------|----------------------|-------------|
| #6 — DB schema | `server/prisma/schema.prisma` | "AC-2 (migration) — structurally sound, additive, matches schema. AC-3 (seed) — correct counts, properly idempotent via upsert. AC-1 (schema matches spec) partial concern — relatedSystem is a FK in code but free-text in the spec (spec itself is self-contradictory here, code is arguably more correct); none of the spec's length/size constraints are enforced in the schema. Overall if schema spec is not critical, this work is already solid." | Responded: relatedSystem as FK is intentional and traceable to spec §11 Decision #1. Length/size constraints are validated at application layer (Issue #8 routes) per spec — Prisma doesn't natively support VARCHAR-length constraints on String fields. Deferred to Issue #8 as agreed. |
| — | — | — | — |

---

## Approval Records

| Issue | PR | Approved By | Date |
|-------|-----|-------------|------|
| #6 | *(PR URL)* | *(reviewer name)* | *(date)* |
| #7 | *(PR URL)* | *(reviewer name)* | *(date)* |
| #8 | *(PR URL)* | *(reviewer name)* | *(date)* |
| #9 | *(PR URL)* | *(reviewer name)* | *(date)* |
| #10 | *(PR URL)* | *(reviewer name)* | *(date)* |
| #11 | *(PR URL)* | *(reviewer name)* | *(pending)* |

---

## Branch and Merge Flow

All feature branches were merged into `lab2-staging` via peer-reviewed Pull Requests. The final release PR merges `lab2-staging` → `main` after all issues are complete and all tests pass.

```
feature/5  → lab2-staging  (via PR, peer-reviewed)
feature/6  → lab2-staging  (via PR, peer-reviewed)
feature/7  → lab2-staging  (via PR, peer-reviewed)
feature/8  → lab2-staging  (via PR, peer-reviewed)
feature/9  → lab2-staging  (via PR, peer-reviewed)
feature/10 → lab2-staging  (via PR, peer-reviewed)
feature/11 → lab2-staging  (via PR, peer-reviewed)
lab2-staging → main        (release PR, peer-reviewed)
```
