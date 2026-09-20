# Lab 3 Peer Review Record

## Reviewer identities

**TauForge** (@TauForge) reviewed Feature 12. **Jinnakan** (@Jinnakan) reviewed Features 13–16. GitHub identities are recorded without inferring legal names. Evidence retrieved 20 September 2026.

## Feature reviews and responses

### Feature 12

- PR: [#33 Feature 12/ Add Lab 3 documentation on docs/lab-03](https://github.com/N0M3KM/TokTickIT/pull/33)
- Branch: `feature/12-lab3-spec-docs` to `lab3-staging`.
- Merged: 2026-09-09T07:57:35Z (UTC).
- **TauForge — APPROVED** (2026-09-09T06:54:00Z). [Review](https://github.com/N0M3KM/TokTickIT/pull/33#pullrequestreview-5150772766)
- Feedback: The changes are clear and consistent with the Lab 3 documentation. No issues from my side
- Author response: Thank you :) [Response](https://github.com/N0M3KM/TokTickIT/pull/33#issuecomment-5598277548)

### Feature 13

- PR: [#34 Feature/13 auth foundation](https://github.com/N0M3KM/TokTickIT/pull/34)
- Branch: `feature/13-auth-foundation` to `lab3-staging`.
- Merged: 2026-09-15T15:27:47Z (UTC).
- **Jinnakan — APPROVED** (2026-09-15T15:27:21Z). [Review](https://github.com/N0M3KM/TokTickIT/pull/34#pullrequestreview-5212090590)
- Feedback: Everything is clear, just future work suggesting. /api/requesters is unauthenticated and leaks emails. But you can fix this later in the next issue that will focus on this topic. Clear to merge, good job.
- Author response: Thank you :) [Response](https://github.com/N0M3KM/TokTickIT/pull/34#issuecomment-5683023211)

### Feature 14

- PR: [#35 Feature/14 staff queue](https://github.com/N0M3KM/TokTickIT/pull/35)
- Branch: `feature/14-staff-queue` to `lab3-staging`.
- Merged: 2026-09-15T15:47:49Z (UTC).
- **Jinnakan — APPROVED** (2026-09-15T15:45:49Z). [Review](https://github.com/N0M3KM/TokTickIT/pull/35#pullrequestreview-5212318203)
- Feedback: lgtm. Good luck with ya next issue.
- Author response: Appreciate your review :D [Response](https://github.com/N0M3KM/TokTickIT/pull/35#issuecomment-5683346090)

### Feature 15

- PR: [#36 feat(#15): add staff ticket operations and discussions](https://github.com/N0M3KM/TokTickIT/pull/36)
- Branch: `feature/15-staff-ticket-ops` to `lab3-staging`.
- Merged: 2026-09-15T16:14:48Z (UTC).
- **Jinnakan — APPROVED** (2026-09-15T16:04:36Z). [Review](https://github.com/N0M3KM/TokTickIT/pull/36#pullrequestreview-5212551826)
- Feedback: lgtm. The most beautiful code I've ever seen today.
- Author response: Appreciate it a lot. [Response](https://github.com/N0M3KM/TokTickIT/pull/36#issuecomment-5683794847)

### Feature 16

- PR: [#37 Feature/16 admin users](https://github.com/N0M3KM/TokTickIT/pull/37)
- Branch: `feature/16-admin-users` to `lab3-staging`.
- Merged: 2026-09-15T16:47:45Z (UTC).
- **Jinnakan — APPROVED** (2026-09-15T16:44:29Z). [Review](https://github.com/N0M3KM/TokTickIT/pull/37#pullrequestreview-5213028492)
- Feedback: Nothing here looks unsafe to merge. The password-generation point is the only thing worth raising. Overall, ready to merge.
- Author response: Thank you for your feedback. I'll cover some minor risks in the next feature. [Response](https://github.com/N0M3KM/TokTickIT/pull/37#issuecomment-5684296579)

## Follow-up implementation

Feature 13 feedback identified the unauthenticated `/api/requesters` email-enumeration risk. Feature 17 removes its mount from `server/src/app.ts`. Feature 16 raised password generation; Feature 17 generates temporary passwords server-side and displays them once in the administrator UI. See commits `6a03966` and `070b35c`. These implementation observations are not additional approvals.

## Release status

[Feature 17 PR #38](https://github.com/N0M3KM/TokTickIT/pull/38) remains open. No Lab 3 release-to-main PR was present in the retrieved PR lists. A completed release and final all-Done Kanban state are not established.

## Reviews given to partners

[Feature 13](https://github.com/Jinnakan/TokTickIT/pull/36) 
Approved: LGTM!! Ready to merge 
Jinnakan's Response: Thank you good sir.

[Feature 14](https://github.com/Jinnakan/TokTickIT/pull/37) 
Approved: The migration is structurally sound (safe enum additions, correct nullable-then-NOT-NULL backfill pattern, id-preserving DevRequester→User cutover with no guessable passwords), and the test/call-site updates are consistent and well-targeted. The only things worth a follow-up (not blockers): confirm the enum-then-DML ordering in one transaction is safe long-term, and note that re-running the seed script will silently reset any live changes made to seeded accounts. 
Jinnakan's Response: Thank you good sir

[Feature 15](https://github.com/Jinnakan/TokTickIT/pull/38) 
Approved: LGTM :D
Jinnakan's Response: Yeap. Look good to me too.

[Feature 16](https://github.com/Jinnakan/TokTickIT/pull/39) 
Approved: LGTM Ready to merge :D
Jinnakan's Response: Thank you for your valuable feed back. Not at all useless. Bless your kind heart.

[Feature 17](https://github.com/Jinnakan/TokTickIT/pull/40) 
Approved: Looking good. Ready to merge.
Jinnakan's Response: thank you 3 times

[Feature 18](https://github.com/Jinnakan/TokTickIT/pull/41) 
Approved: LGTM! Ready to merge ig
Jinnakan's Response: Thank you ig

[Feature 19](https://github.com/Jinnakan/TokTickIT/pull/42) 
Approved: Clean and readable code. Well done :D
Jinnakan's Response: Thank you so much.

[Feature 20](https://github.com/Jinnakan/TokTickIT/pull/43) 
Approved: LGTM!!
Jinnakan's Response: Thank you very much

[Feature 21](https://github.com/Jinnakan/TokTickIT/pull/44) 
Approved: LGTM
Jinnakan's Response: sgtm

[Feature 22](https://github.com/Jinnakan/TokTickIT/pull/45) 
Approved: Everything seems completed. Ready to merge :D
Jinnakan's Response: Thank you good sir. Pressure doing this fantastic lab with you.



Lab 3 outgoing partner-review evidence was not established from this repository's received reviews. Historical Lab 2 partner reviews are not counted as Lab 3 evidence.
