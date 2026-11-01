# Lab 4 AI Use Record

## LLM and tools used

- OpenAI Codex: used on 27 September 2026 to read the supplied Lab 4 PDF, compare existing Lab 2/3 contracts and GitHub issue templates, and draft local Lab 4 engineering documents. The exact model identifier is not independently recorded here; no model version is invented.
- pypdf/Poppler: document extraction and visual inspection; repository reads and GitHub read-only access: baseline/template verification. These tools are not human peer reviewers.
- The original drafting session did not publish or implement features. On 5 October 2026 the owner authorized issue publication, Feature 18 commit/push and local-only Feature 19 work. No product-test pass, peer approval or merge is implied by publication.

## Selected requests restated as engineering prompts

| # | Phase | Engineering restatement | Result / verification boundary |
| --- | --- | --- | --- |
| 1 | Specification | Analyze the Lab 4 handout and existing Lab 3 documentation. Prepare a traceable engineering contract covering functional requirements, acceptance criteria, test strategy, UI behavior and API design. Define the main to lab04-staging to feature-branch workflow and draft issues using the established GitHub template. Keep all changes local until publication is authorized. | Local draft contracts and issue bodies prepared. Assignment grading additions (assignment/lifecycle/history) explicitly addressed; chosen policies flagged for owner approval. No implemented feature or passing product test claimed. |
| 2 | Publication / coding start | Publish GitHub issues for Features 18 through 24. Create Feature 18 from lab04-staging, commit the approved specification documents and push its branch. Begin Feature 19 locally, but defer its commit and push until the owner has reviewed and merged Feature 18. | Issues #40-46 created; Feature 18 publication authorized. Feature 19 implementation evidence belongs to its later increment, not this documentation commit. |
| 3 | 30 October, parallel preparation | Use separate sub-agent threads to progress independent feature tasks concurrently. Identify dependencies and keep each task within its assigned scope. Preserve the owner-managed pull-request and merge sequence, and clearly identify any prerequisite integration before the next feature proceeds. | Separate backend validation and UI preparation produced focused passing tests; work stayed local until the owner's later publication instruction. |
| 4 | 30 October, Feature 19 publication | Publish the current Feature 19 increment to its GitHub feature branch so that the owner can review the changes and integrate them through a pull request. Keep the published scope and any remaining implementation work explicit. | Published validation slice `992fc6c`; missing persistence/API work was explicitly recorded rather than claiming completion. Owner merged PR #48. |
| 5 | 30 October, Feature 20 | Feature 19 has been merged. Continue Feature 20, tracked by issue #42, against the integrated baseline. Complete the Actions Taken UI within the approved scope, record its verification evidence, then commit and push the feature branch for review. | Active Actions Taken UI published as `1281be8`; mock-only browser checks were identified honestly. Owner merged PR #49. |
| 6 | 30 October, Feature 21 | Continue Feature 21 against the merged baseline and complete its ticket-workflow scope. Progress another independent feature in parallel where dependencies permit. Execute the already-authorized work without repeated permission requests, while retaining the owner-managed PR and merge process. | Added missing persistence, workflow gates/audit and real disposable PostgreSQL/browser checks in `fdb1289`; requester helpers prepared separately. Owner merged PR #50. |
| 7 | 30-31 October, Feature 22 | Implement Feature 22, the requester dashboard, using the approved issue and existing application conventions. Resume the interrupted work from its current state, carry the feature through its remaining implementation and verification steps, and prepare the branch for the established review workflow. | Owned dashboard/list integration and SQL/browser reconciliation published as `fd0ee48`; owner merged PR #51. |
| 8 | 31 October, Feature 23 | Complete Feature 23, the IT Staff and Administrator Dashboard, according to its approved issue scope. Finish the operational metrics and current-user action views, document the implementation evidence and prepare the completed increment for owner-managed review and integration. | Staff/admin operational dashboard and both-endpoint performance evidence published as `f8a8948`; owner subsequently merged PR #53 on 1 November 2026. |
| 9 | 31 October, release preparation | Continue the remaining release-preparation work from the current repository state. Reuse established instructions and verification evidence, run only checks justified by the changes, and avoid redundant investigation. Keep progress and evidence concise while preserving token efficiency. | Authenticated legacy fixture migration verified (214 client and 388 server tests); insert-only seed and separate logical database/files recovery passed. Release evidence prepared; Feature 23 subsequently merged in PR #53 after Feature 24 PR #52; combined-staging verification remains. No final-main result, peer approval or student reflection invented. |

These nine entries are edited engineering restatements of actual requests, not verbatim quotations. They preserve the original task scope and authorization boundaries while clarifying terminology and context; they do not establish that the expanded wording was used historically. The recorded feature commits and `artifacts/lab-04/feature-{21,22,23}-verification.md` provide implementation evidence; passing agent checks are not human peer review.

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
