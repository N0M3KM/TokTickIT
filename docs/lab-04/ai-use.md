# Lab 4 AI Use Record

## LLM and tools used

- OpenAI Codex: used on 27 September 2026 to read the supplied Lab 4 PDF, compare existing Lab 2/3 contracts and GitHub issue templates, and draft local Lab 4 engineering documents. The exact model identifier is not independently recorded here; no model version is invented.
- pypdf/Poppler: document extraction and visual inspection; repository reads and GitHub read-only access: baseline/template verification. These tools are not human peer reviewers.
- The original drafting session did not publish or implement features. On 5 October 2026 the owner authorized issue publication, Feature 18 commit/push and local-only Feature 19 work. No product-test pass, peer approval or merge is implied by publication.

## Actual selected prompt record

| # | Phase | Actual prompt summary | Result / verification boundary |
| --- | --- | --- | --- |
| 1 | Specification | Read Lab 4 instructions; prepare complete specification/tests/UI/API and related markdowns like Lab 3; include every requirement/AC and main -> lab04-staging -> feature/* workflow; list issues using earlier GitHub template; do not commit/push before confirmation. | Local draft contracts and issue bodies prepared. Assignment grading additions (assignment/lifecycle/history) explicitly addressed; chosen policies flagged for owner approval. No implemented feature or passing product test claimed. |
| 2 | Publication / coding start | Create GitHub issues for Features 18-24; commit/push documentation on feature18/lab04-spec from lab04-staging; start feature19 locally but do not commit/push until the owner reviews and merges Feature 18. | Issues #40-46 created; Feature 18 publication authorized. Feature 19 implementation evidence belongs to its later increment, not this documentation commit. |
| 3 | 30 October, parallel preparation | Run sub-agents/sub-threads for parallel tasks; remind me that I must PR and merge first. | Separate backend validation and UI preparation produced focused passing tests; work stayed local until the owner's later publication instruction. |
| 4 | 30 October, Feature 19 publication | Push Feature 19 to GitHub. | Published validation slice `992fc6c`; missing persistence/API work was explicitly recorded rather than claiming completion. Owner merged PR #48. |
| 5 | 30 October, Feature 20 | PR for #41 is merged; continue #42 and commit/push. | Active Actions Taken UI published as `1281be8`; mock-only browser checks were identified honestly. Owner merged PR #49. |
| 6 | 30 October, Feature 21 | Continue on Feature 21; run another feature in parallel and do not ask permission. | Added missing persistence, workflow gates/audit and real disposable PostgreSQL/browser checks in `fdb1289`; requester helpers prepared separately. Owner merged PR #50. |
| 7 | 30-31 October, Feature 22 | Start Feature 22; continue after the interrupted session. | Owned dashboard/list integration and SQL/browser reconciliation published as `fd0ee48`; owner merged PR #51. |
| 8 | 31 October, Feature 23 | Finish the last feature, 23. | Staff/admin operational dashboard and both-endpoint performance evidence published as `f8a8948`; PR/merge remains the owner's step. |
| 9 | 31 October, release preparation | Continue; avoid unnecessary tests and repeated instruction reads, preserve token use. | Authenticated legacy fixture migration verified (214 client and 388 server tests); insert-only seed and separate logical database/files recovery passed. Release evidence prepared; Feature 23 integration remains pending. No final-main result, peer approval or student reflection invented. |

These are nine selected actual prompts, including the original two contract/publication requests. The recorded feature commits and `artifacts/lab-04/feature-{21,22,23}-verification.md` provide implementation evidence; passing agent checks are not human peer review.

## Future record template (not historical prompts)

| Date | Actual prompt summary | Specification or coding agent | Accepted/rejected output | Human verification and evidence |
| --- | --- | --- | --- | --- |
| Pending | Pending real request | Pending | Pending | Pending |

Potential phases to document when they actually occur: migration/action API, action UI, workflow gate, requester dashboard, staff dashboard, concurrency/security review, regression/accessibility and release evidence. These suggestions are not assertions that prompts have occurred.

## My Reflection

**To be written/reviewed by the student after implementation.** Reflection prompts:

- Which ambiguity did the specification agent help identify (e.g. graded action lifecycle versus initial field list)? Which policy did I approve or change, and why?
- How did the coding agent follow or diverge from approved contracts? What did I verify with real DB/API/browser evidence?
- What did tests or peer review reveal that generated code/documentation initially missed?
- How did I prevent overclaiming passing tests, historical approvals or completed release steps?

Do not present this planning guidance as the student's completed personal reflection. The final report must include the student's own short reflection and selection of 6-10 real prompts.
