# Staff and Administrator Dashboard (#45 / Feature 23)

`Dashboard.tsx` exports `StaffDashboard`. Its sole request is the protected
`GET /api/dashboards/staff`; metrics and current-user assignment predicates remain server-owned.
Administrators use their own account ID for personal ticket/action metrics, with the same staff scope.

State is isolated by account ID and role. Aborted or late requests cannot replace another identity's state.
Refresh failure may retain data with its original snapshot timestamp; authentication/authorization failures clear it.
No account data is persisted in module caches or browser storage.

`api.ts` validates counts, complete status/priority buckets, bounded lists and canonical queue/ticket/action destinations.
Action counts and distinct related-ticket counts are separate; action links target their individual detail anchors.
Root routing/navigation and existing Ticket Detail's off-page action fetching supply full integration.

Component tests use synthetic HTTP fixtures. They do not claim independent DB reconciliation,
real persistence, performance evidence or browser visual verification.
