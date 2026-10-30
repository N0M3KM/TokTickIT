# Lab 4 Engineering Contract

**Status:** Engineering contract for owner review. Originally drafted 27 September 2026; publication authorized 5 October 2026 on `feature18/lab04-spec`. Issues #40-46 track logical Features 18-24. No passing application tests, peer approvals or merges are claimed by this documentation increment.

This folder follows the Lab 3 documentation style while preserving `../lab-03/`. The Lab 4 handout explicitly requires `docs/lab-04/` in sections 4.4, 6, 9, 10 and 12.

| Document | Purpose |
| --- | --- |
| [specification.md](specification.md) | Eleven-section engineering contract, FR/BR/AC, data decisions, development workflow and completion gates |
| [tests.md](tests.md) | Planned tests, complete AC mapping, evidence and regression gates |
| [ui-spec.md](ui-spec.md) | Zen Green screens, interaction states, accessibility and screenshot checklist |
| [api-spec.md](api-spec.md) | Proposed REST additions, validation, security, concurrency and dashboard queries |
| [issues.md](issues.md) | Copy-ready issue drafts using the previous GitHub issue template |
| [reviewer.md](reviewer.md) | Unfilled peer-review evidence register |
| [ai-use.md](ai-use.md) | Honest AI-use record and future prompt/evidence guidance |
| [submission-checklist.md](submission-checklist.md) | All nine required report parts and evidence destinations |

## Source and precedence

- Source: `SE+Lab+4 (1).pdf`, 11 pages, supplied by the user; page/section traceability is in the specification.
- Baseline: Lab 2/3 contracts, current Prisma schema, active client entry `client/src/main.tsx`, and server routes at local commit `8d06226`.
- Issue style checked against [GitHub issue 27](https://github.com/N0M3KM/TokTickIT/issues/27), [30](https://github.com/N0M3KM/TokTickIT/issues/30) and [32](https://github.com/N0M3KM/TokTickIT/issues/32): title, Type, Branch, Acceptance criteria.
- The user's requested branch name is **`lab04-staging`**, even though the handout's submission example says `lab4-staging`. Use `main -> lab04-staging -> feature/*`, with reviewed integration in the reverse direction.
- Proposed choices in specification section 11 need owner acceptance before implementation. The handout requests a resolution gate and action lifecycle but does not prescribe their exact rules.
- Logical feature numbers 18-24 continue the previous 12-17 naming convention; their actual GitHub issues are #40-46 respectively (see issues.md).

Read `specification.md` first, then the API/UI/test contracts and the selected issue. The owner authorized issue creation and Feature 18 commit/push, followed by local uncommitted Feature 19 work. Feature 19 must not be committed or pushed until the owner verifies and merges Feature 18 into `lab04-staging`. No automatic merge is authorized.
