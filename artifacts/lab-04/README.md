# Lab 4 evidence index

Release preparation began 31 October 2026 from `lab04-staging` at `e33e80e`.
This is an evidence index, not a completed release or final-main certification.

| Increment | Published evidence | Status at preparation start |
| --- | --- | --- |
| Feature 18 / #40 | Contract in `docs/lab-04/`; commit `bb8a4d2` | PR #47 merged |
| Feature 19 / #41 | Validation `992fc6c`; supporting persistence in Feature 21 | PR #48 merged |
| Feature 20 / #42 | [UI contract checks](feature-42-verification.md), `1281be8` | PR #49 merged |
| Feature 21 / #43 | [Real workflow/API/browser evidence](feature-21-verification.md), `fdb1289` | PR #50 merged |
| Feature 22 / #44 | [Owned dashboard evidence](feature-22-verification.md), `fd0ee48` | PR #51 merged |
| Feature 23 / #45 | [Published staff dashboard evidence](https://github.com/N0M3KM/TokTickIT/blob/f8a8948/artifacts/lab-04/feature-23-verification.md), `f8a8948` | Pushed; not yet in staging |
| Feature 24 / #46 | [Fixture and seed/recovery evidence](release-preparation.md) | Preparation verified; final release pending |

Screenshots use synthetic fixtures and identify role/viewport/state in each
feature record. `*-mocked-*` images are mock-only; `*-real-*` checks used actual
disposable PostgreSQL/API services. No production databases, private uploads,
tokens or real passwords belong here. Transient runner output is ignored.

## Remaining release gates

- Owner-reviewed Feature 23 merge before final Feature 24 integration.
- Fixture migration verified: client 214/214 and server 388/388. Recheck combined release after Feature 23 integration; reuse unaffected feature evidence.
- Repeat-seed and separate database/files logical recovery verified in preparation.
- Remaining UI/accessibility/visual checklist with actual observations.
- Real independent review records and the student's own AI-use reflection.
- Separately authorized main release integration, final main SHA and verification.
- Single final Answer Part 1..9 PDF after its evidence/human sections are available.
  Never substitute invented approvals, reflection or final-main results.
