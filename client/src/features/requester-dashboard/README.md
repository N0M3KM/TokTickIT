# Requester dashboard

The default export is mounted by the active `/dashboard` route and keyed by
authenticated requester ID. Staff/admin route to existing landing screens until
Feature 23. Data comes from `/api/dashboards/requester`, never page-derived counts.

The response parser allowlists metric links, ticket IDs/paths, safe previews,
timestamps, counts and bounded arrays. Fetch state belongs to one identity and
rejects late aborted responses. Recoverable refresh errors retain a timestamped
prior snapshot; forbidden/session responses clear it. No localStorage is used.

19 component/parser tests and the actual browser/database flow are recorded in
`artifacts/lab-04/feature-22-verification.md`. The six old Lab 2 collection failures
are documented; they were not deleted or hidden.
