# Feature 19 local work in progress

Feature 19 / GitHub issue #41: https://github.com/N0M3KM/TokTickIT/issues/41

Branch: `feature19/actions-taken-foundation`, updated by fast-forward to `lab04-staging` at `7aaed92` before publishing the validation slice.
Feature 18 specification PR #47 was merged into `lab04-staging` on 30 October 2026. The owner subsequently authorized committing and pushing Feature 19. Only the Feature 19 validation files are included; parallel Feature 20 UI preparation remains local. The owner will perform PR and merge steps. Feature 19 / #41 must be completed, reviewed and merged into `lab04-staging` before Feature 20 / #42 completes API integration.

Contract baseline checked on 30 October 2026: `docs/lab-04/specification.md` (blob `1552659ba293967d2acf158d924f8356a418c398`) and `docs/lab-04/api-spec.md` (blob `ec7b1eacb08e6a68393f66f2962b42315efa5438`) on remote `lab04-staging`. BR-07 explicitly requires nonblank completion result and follow-up=false; cancellation retains previous result/follow-up information.

## Initial implementation slice - 5 October 2026

- `server/src/lib/actionValidation.ts`: strict create DTO normalization, field/date bounds, protected-field rejection, conditional follow-up validation, action transition/completion/cancellation guards, UUID validation and canonical business-intent fingerprint.
- `action-validation.unit.test.ts`: 47 cases for UNIT-01.
- `action-workflow.unit.test.ts`: 27 cases for UNIT-02.
- `idempotency.unit.test.ts`: 13 cases for UNIT-07.

The module is not mounted on a route. Database role/ownership checks, active-assignee lookup, parent locks, durable idempotency and atomic audit persistence must be implemented by the API/service layer. Pure unit tests do not establish those properties.

## Verification evidence

Command: `npm run test --workspace=server -- tests/lab-04`

- Initial run: 3 failed suites because the new implementation module did not yet exist (collection failure, not failing behavioral assertions).
- After implementation: 3 files, 87 tests passed, zero skipped.
- Initial TypeScript build caught use of Object.hasOwn with the ES2020 target; replaced with Object.prototype.hasOwnProperty.call instead of changing project runtime settings.
- Final rerun: all 87 unit tests passed again and `npm run build --workspace=server` completed successfully. This is not a complete Feature 19 or full-regression certification.

No database was migrated or seeded. No runtime endpoints, UI or production data were changed by this slice.

## Parallel validation increment - 30 October 2026

- Added `parseUpdateAction` to validate a PATCH against a fresh authorized business snapshot, preserving omitted values while validating the resulting record. It requires both versions, rejects unknown/protected fields and version-only updates, normalizes nullable text/date values, and clears the previous follow-up note when explicitly disabling follow-up without a supplied note.
- Added action matrix checks, terminal-action rejection (`ACTION_READ_ONLY`), atomic completion-field validation and required bounded cancellation reason. The helper does not establish database eligibility, parent state, concurrency or audit properties; those remain transactional service responsibilities.
- Added `action-update.unit.test.ts`: 43 cases covering resulting-record validation, lifecycle-sensitive updates and malformed status values (including objects with unsafe coercion).
- Red run: 38 cases collected, 8 failed because the new export did not exist; 30 negative assertions also passed on that missing-function exception, so they are not independent red behavioral evidence.
- Final green command from `server`: `node ../node_modules/vitest/vitest.mjs run tests/lab-04` — 4 files, 130 tests passed (the previous 87 plus 43 additions), zero skipped. Vitest required approval to write its temporary config/worker files after a sandbox EPERM.
- TypeScript check passed: `node node_modules/typescript/bin/tsc --noEmit -p server/tsconfig.json` from repository root.

This increment is preparatory validation only. Issue #41 remains incomplete. The owner authorized publishing this slice after parallel preparation. No feature PR, feature integration merge, migration or seed is part of this publication.

## Remaining Feature 19 work

1. Keep the implementation aligned with the integrated staging specification; reconcile any further reviewed policy changes.
2. Add ActionTaken/ActionRevision schema, versions, timestamp backfill and indexes with non-destructive migration.
3. Add transaction-safe action APIs/history/authorization, active-assignee checks, optimistic concurrency and durable idempotency.
4. Add expected versions to existing ticket operations and their current client callers.
5. Implement non-destructive repeat seed, migration preservation and separate database/files recovery drill.
6. Add real API/security/concurrency/migration tests and regression evidence. Do not mark issue #41 complete from these unit tests alone.
