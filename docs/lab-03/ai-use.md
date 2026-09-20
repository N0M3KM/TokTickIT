# Lab 3 AI Use Record

## LLMs and tools used

- **Kiro**, Amazon Kiro IDE agent, model **Auto**: recorded in the original Lab 3 specification-stage log. The exact underlying model was not recorded.
- **OpenAI Codex**, coding assistant: used for Features 13–17, authentication/UI corrections, tests, and this report. The exact model identifier for the historical turns is not established, so no model version is claimed.
- Automated checks used Vitest, React Testing Library, Supertest, and Playwright/Chrome. These are verification tools, not independent human reviewers.

## Selected key prompts

Prompts below summarize the recorded requests rather than reproduce a complete chat transcript.

| # | Phase | Prompt summary | Purpose and observed outcome |
| --- | --- | --- | --- |
| 1 | Specification | Read the Lab 3 PDF and create specification, tests, UI/API specifications, reviewer, and AI-use records before coding. | Original Kiro log records six engineering documents and 77 planned tests. |
| 2 | Authentication | Implement Issue 13 on feature/13-auth-foundation from lab3-staging; follow the markdown specifications. | Authentication foundation introduced; reviewed in PR #34. |
| 3 | Queue | Start and continue Feature 14; commit and push the staff queue. | Queue API/UI implemented; approved PR #35. |
| 4 | Operations | Implement Feature 15 and check Issue #30 branch naming and acceptance criteria. | Ownership, priority/status operations and discussions; approved PR #36. |
| 5 | Administration | Continue Feature 16 according to Issue #31. | Administrator user management; approved PR #37. |
| 6 | Security and release | Recheck auth flows, ticket loading and authorization; remove requesters endpoint, limit login, generate temporary passwords server-side, complete Feature 17. | Security and integration corrections in commits 6a03966 and 070b35c; PR #38 remains open. |
| 7 | UI integration | Replace the old Lab 2 selector and authentication-coming notice with the Lab 3 UI. | Authenticated routing, login/help/change-password, sign-out, and role-specific navigation added to the active client. |
| 8 | Visual consistency | Apply Zen Green from ui-spec.md; update README features and requester seed credentials; complete Change Password UI. | Green styling, README and focused UI tests updated; seeded passwords identified as local-development defaults. |
| 9 | Evidence and report | Follow the Lab 3 PDF and Lab 2 report format; collect Feature 12–16 reviews, update AI-use, test and capture results. | GitHub approvals/responses retrieved; fresh test output and real local screenshots collected; legacy regression failures reported explicitly. |

## My Reflection

The specification agent provided an early contract for roles, migration rules and acceptance criteria. Its output still needed checking: a planned test count did not prove that the tests existed or passed. The coding agent helped build modular features, but the visible application initially remained on an older Lab 2 client. Checking the running browser, rather than relying on commit summaries, exposed that integration gap.

Review feedback improved the security design, especially removal of the unauthenticated requester endpoint and server-generated temporary passwords. Fresh regression testing also showed why changing authentication requires updating older fixtures. I should treat generated code, documentation and completion claims as proposals to verify against requirements, reviewer comments and reproducible tests. A focused passing suite is useful evidence, but it is not a substitute for full regression results or a reviewed release to main.

## Verification boundary

Evidence is collected from feature/17-lab3-e2e-and-release at 070b35c plus documentation/test-locator changes. It is not a passing-main release certification. No merge, release, or reviewer approval was created by the report work.
