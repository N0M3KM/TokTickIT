# Lab 2 — AI Use Record

## LLM Used

**Kiro** (Amazon Kiro IDE built-in AI coding agent) — model: Auto (dynamically selected).
Used throughout all phases of Lab 2: specification drafting, implementation, test writing, debugging, and documentation.

---

## Key Prompts Table

The following 10 prompts represent the most significant interactions during the sprint. They demonstrate how the AI agent was used as an engineering assistant while the student retained responsibility for specifications, design decisions, and acceptance of all output.

| # | Phase | Prompt Summary | Purpose | Outcome |
|---|-------|----------------|---------|---------|
| 1 | Specification | "Read the Lab 2 instruction PDF carefully. Your task is to create specification.md, tests.md, ui-spec.md, and api-spec.md. Place them in docs/lab-02/. Do not write any code." | Generate the full engineering contract before any implementation. | Four complete spec documents created with BR-01–28, FR-01–20, AC-01–23, 93 planned tests, Zen Green color tokens, and full API contract. Reviewed, corrected, and approved by student before coding began. |
| 2 | Specification | "Write instructions.md to provide the AI coding agent with step-by-step instructions for each issue (#6–#11). Each issue must be self-contained so the agent cannot accidentally implement future-issue scope." | Scope-guard each implementation issue to prevent over-building. | instructions.md created with explicit out-of-scope boundaries, step-by-step order, and test requirements per issue. |
| 3 | Database | "Start issue #6. Read specification.md and other .md files carefully. DO NOT COMMIT OR PUSH YET." | Implement schema, migration, and seed per spec. | schema.prisma, migration SQL, and idempotent seed.ts created. Verified: prisma validate passed, seed ran twice with no duplicates, inactive requester confirmed isActive=false. |
| 4 | API | "Start issue #8 but DO NOT COMMIT AND PUSH yet. Wait for #7 PR merged by my team first." | Implement all ticket and attachment API endpoints alongside their unit and API tests. | 7 new files: ticketNumber.ts, ticketValidation.ts, attachmentValidation.ts, upload.ts, tickets.ts, attachments.ts, updated app.ts. 113 server tests passing covering UNIT-01–10 and API-01–32. |
| 5 | Debugging | (After test run showing `categories.map is not a function`) "Continue the work." | Diagnose and fix a mock-isolation bug in MyTickets.test.tsx where `mockResolvedValue` overwrote the categories response. | Root cause identified: non-URL-aware mock setup. Fixed using `mockImplementation(url => ...)` to route categories and tickets fetches independently. All 104 client tests passed. |
| 6 | UI | "Start the task of issue #9. Do not commit or push yet." | Build the Requester Selection screen and Application Shell with full Zen Green theming. | RequesterContext, RequireRequester, AppShell, RequesterSelector, tokens.css created. 35 client tests passing covering UI-01–06 and STYLE-01. |
| 7 | UI | "Ok now start issue #10. Do not commit or push yet." | Build Create Ticket, My Tickets, and Ticket Detail screens with all shared components. | 6 shared components + 3 pages + AttachmentSection created. 104 client tests covering UI-07–28 and STYLE-02–07. |
| 8 | Specification review | "According to the task, list me the issues I have to open on GitHub like previous issues. Template: [issue template]" | Translate the spec documents into concrete GitHub Issues with acceptance criteria. | 14 issues (#5–#18) generated, then condensed to 7 issues (#5–#11) at student request. Each issue has branch name, type, and acceptance criteria. |
| 9 | Review response | "Got review from #6: [reviewer comment about FK vs free-text and missing DB-level constraints]. Response or nothing?" | Draft a professional PR review response. | Concise response written explaining FK design decision (traceable to spec §11 Decision #1) and deferral of length constraints to application-layer validation in Issue #8. |
| 10 | Release | "Commit and push all the files related to issue #10 to branch feature/10 (create a branch as well), then start the task for issue #11." | Stage exactly the right files, commit with a descriptive message, push, then continue to the next issue without stopping. | Clean commit of 15 files with full commit message, pushed to `origin/feature/10-ticket-screens-ui`, then immediately started Issue #11 on a new branch. |

---

## My Reflection

Working with Kiro as an engineering assistant throughout Lab 2 was genuinely useful, but required constant active engagement rather than passive acceptance. The most important insight was that the quality of the AI's output depended almost entirely on the quality of the specification written before implementation began — the investment in `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` paid off by giving the agent clear, testable contracts to implement against.

The agent was strongest at mechanical tasks: translating spec tables into Prisma schemas, writing repetitive test scaffolding, and generating consistent boilerplate across many files in parallel. It was weakest at test mock isolation (as seen in the `categories.map` bug), where understanding the runtime interaction between async React state and Vitest's `mockResolvedValue` required stepping in and reasoning from first principles.

The most valuable discipline was the requirement to keep issues strictly scoped — the agent would occasionally suggest adding future-sprint features, and having explicit "out of scope" sections in `instructions.md` made it straightforward to redirect it. I also learned that reviewing every commit diff carefully, rather than trusting "all tests pass" as sufficient evidence of correctness, revealed issues that tests did not catch, such as the PR reviewer's observation about missing DB-level constraints.

Overall, the AI accelerated implementation by roughly 3–4× but did not replace the need for engineering judgment on architecture decisions, business rule interpretation, or test design.
