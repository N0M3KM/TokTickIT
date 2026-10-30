# Actions Taken UI (#42 / Feature 20)

Branch: `feature/20-actions-taken-ui`, created from `lab04-staging` at `0301f6d`
after the owner merged PR #48 for #41. Commit/push authorized by the owner on
30 October 2026. The owner retains PR review and merge responsibility.

## Implemented client behavior

- Active `main.tsx` Ticket Detail renders `TicketActions` for the authenticated
  user. Components are keyed by user/ticket to clear state across identities.
- All-status chronological server-paginated list, full action view, revision
  history, safe loading/empty/forbidden/not-found/failure states and Bangkok dates.
- Staff/admin create/edit/assignment, Start, Complete and Cancel with separate
  confirmations, conditional validation and immutable performer attribution.
- Requesters have no mutation controls or assignee lookup; terminal actions and
  terminal parent tickets remain read-only.
- Versioned writes and safe errors use the API contract. Unknown create outcomes
  pause editing and retry the exact original body/key. Stale updates preserve the
  draft, show latest server values and require explicit reconciliation.
- Drafts remain in memory after recoverable failures. Dirty discard, in-app and
  Back navigation require confirmation; reload/close triggers the browser warning.
  Session expiry may clear drafts, as explained in the form. No localStorage cache.
- Dashboard hashes fetch/focus an action even outside the current page. History
  loads on demand; superseded/unmounted requests are cancelled.
- Routing uses the installed React Router data router to support `useBlocker`;
  existing route paths and auth guards are retained.

## Verification on 30 October 2026

- `npm run test --workspace=client -- src/features/actions-taken/ src/lab-03/`:
  6 files, **68 tests passed** (50 action feature tests and 18 auth tests).
- `npm run build`: client production build and server TypeScript build passed.
- Start the client with `npm run dev --workspace=client -- --host 127.0.0.1`, then
  `node node_modules/@playwright/test/cli.js test --config=playwright.actions.config.ts`:
  **4 browser tests passed**, Chrome at 1280x800, 900x1024, 375x812 and 320x812.
- Browser tests intercept API calls using synthetic fixtures. They assert create
  versions/keys, assignment, Start/Complete/Cancel, dirty-navigation protection,
  no horizontal page overflow and no page errors. Screenshots are explicitly
  named `*-mocked-*.png`; they are not persistence evidence.
- `npm run test --workspace=client`: **71 tests passed, 6 suites failed to
  collect**. Existing Lab 2 suites still import the removed
  `../context/RequesterContext.js`. These unchanged legacy fixtures also exist
  in the staging baseline and remain release-regression work; none were hidden.
- Initial default Playwright launch failed because its bundled browser was not
  installed; the existing Chrome channel ran successfully. Existing iPad/iPhone
  projects require WebKit, so the dedicated config explicitly uses Chrome at
  each viewport; Safari/WebKit coverage is not claimed.

## Outstanding prerequisite and completion gate

**#41 was merged as a validation-only slice.** Staging at `0301f6d` has no action
models, migrations, action route handlers or durable version/idempotency/history
storage. This UI targets the approved contract but real action requests cannot
persist against that backend yet. Do not mark #42 complete based on mocked tests.

Finish the remaining #41 backend work, then run UI-02..04/UI-08 and E2E-01 with
real authorized sessions and database assertions. Confirm the final revision
snapshot identity shape, capture real persistence screenshots, and complete
keyboard/contrast/zoom/browser and role/accessibility checklists. The current
history renderer allowlists business fields and intentionally omits unspecified
identity snapshot structures rather than displaying arbitrary JSON.

Evidence: `artifacts/lab-04/feature-42-verification.md`.
