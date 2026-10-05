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

The submission requires **6-10 selected actual prompts**. Two Lab 4 user prompts are recorded so far; do not manufacture additional prompts. Add real prompts as future features are implemented and verified. Summarize, redact secrets and retain date, intended task, actual outcome and evidence link.

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
