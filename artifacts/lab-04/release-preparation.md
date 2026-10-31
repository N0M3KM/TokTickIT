# Release preparation verification

Prepared on 31 October 2026 on `feature/24-lab4-hardening-release`, based on staging commit `e33e80e` (Features 18–22). Feature 23 (`f8a8948`) remains a separate published branch awaiting the owner's PR/merge. These results do not certify the combined Feature 23 release or final main.

## Changes and observed results

- Migrated legacy client/server fixtures from the retired requester picker to signed sessions and current role/ownership rules. Preserved validation, filtering, attachment and safe-error coverage; `/api/requesters` remains unavailable.
- Complete client suite: **214 passed, 0 failed, 0 pending**. [Machine report](test-results/release-prep-client.json).
- Complete server suite: **388 passed, 0 failed, 0 pending**. [Machine report](test-results/release-prep-server.json).
- Seed upserts now insert missing records without resetting edited passwords, roles, active flags, reference data or existing ticket/action snapshots. Stable demo fixtures cover eight ticket statuses, four priorities, four action statuses, multiple performers, follow-up, inactive historical staff, an empty requester and legacy estimated resolution.
- `npm run test:seed-recovery`: **PASS**, using disposable loopback PostgreSQL only. Two seeds preserved deliberately edited rows, versions, timestamps, passwords and audit revisions. No configured application database was touched.
- Recovery copied a whitelisted logical JSON archive into a separately migrated database, restored a synthetic attachment, and verified row/ID/relationship equality, password verification, sequence safety and file SHA-256. Recovery phase: **3048.89 ms**. [Sanitized summary](test-results/seed-recovery-summary.json).

Native `pg_dump`/`pg_restore` tools were unavailable in the embedded Windows distribution. This result verifies the application's logical archive exercise; it does not certify native dump compatibility. Temporary archives and password hashes are not committed.

Existing feature database/browser/build evidence is indexed in [README](README.md). Unchanged frontend production code did not warrant another build or browser run. Remaining integration, human review/reflection, accessibility observations and final report gates are listed there.
