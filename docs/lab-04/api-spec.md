# Lab 4 REST API Contract

**Status: proposed, not implemented.** Read [specification.md](specification.md) for authoritative roles, matrices and BRs. Existing Lab 2/3 APIs continue except for the explicitly versioned workflow request changes below. Base `/api`; same-origin browser calls use `credentials: 'same-origin'`. Backend remains port 3001 behind the existing proxy.

## 1. Authentication, authorization and common conventions

- JWT httpOnly cookie and existing active-user / mandatory-password-change guards apply before accessing protected data. No bearer token or identity stored in browser localStorage is introduced.
- REQUESTER (R): reads own tickets/actions/shared history and requester dashboard; no action writes. IT_STAFF (S) / ADMINISTRATOR (A): read/write accessible actions and staff dashboard. Admin retains user management.
- Ownership comes from session identity. A requester-supplied requesterId, performedById, updatedById, createdAt or parent-changing ticketId is rejected in new action DTOs, not trusted.
- New DTOs reject unknown keys; IDs/versions are positive safe integers, UUIDs validated; JSON body limit 32 KiB for new endpoints. JSON field validation precedes business updates, but authentication/role checks precede returning sensitive information.
- Match action to parent ticket in every nested lookup. Missing ticket/action or wrong parent returns 404. Existing non-owned ticket returns generic 403 without content, preserving the existing ownership convention.
- UTC ISO-8601 response timestamps; input instants require `Z` or explicit offset. UI display is Asia/Bangkok. All protected action/dashboard responses use `Cache-Control: no-store`.
- Text is plain text, trimmed/length-checked and escaped on display; never render supplied HTML. Parameterized Prisma queries only.
- Keep existing cookie security policy; validate same-origin mutation requests, never introduce wildcard credentialed CORS. Login throttling remains active.

## 2. Endpoint summary and ownership of implementation

| Method | Path | Access | Success | Feature |
| --- | --- | --- | --- | --- |
| GET | `/tickets/:id/actions` | R own; S/A all | 200 paged actions | 19 |
| POST | `/tickets/:id/actions` | S/A | 201 created; 200 replay | 19 |
| GET | `/tickets/:id/actions/:actionId` | R own; S/A all | 200 action | 19 |
| PATCH | `/tickets/:id/actions/:actionId` | S/A | 200 action | 19 |
| GET | `/tickets/:id/actions/:actionId/history` | R own; S/A all | 200 paged revisions | 19 |
| GET | `/tickets/:id/history` | R own; S/A all | 200 paged public workflow events | 21 |
| GET | `/dashboards/requester` | R | 200 requester summary | 22 |
| GET | `/dashboards/staff` | S/A | 200 staff summary | 23 |
| GET | `/queue/owners` | S/A | Existing active staff/admin `{id,name}[]` | Reuse in 19/20 |
| PATCH | `/tickets/:id/owner` | S/A | 200 ticket | 19 version guard; 21 audit |
| PATCH | `/tickets/:id/it-priority` | S/A | 200 ticket | 19 version guard; 21 audit |
| PATCH | `/tickets/:id/status` | R own reopening; S/A matrix | 200 ticket | 19 version guard; 21 gate/audit |
| POST | `/tickets/:id/requester-resolved` | R own | 200 indicator and version | 19 version guard; 21 audit |
| GET | `/tickets`, `/queue` | Existing R / S/A restrictions | Existing page envelope, extended filters | 22/23 |
| GET | `/health` | Existing public health | Existing safe response | 24 regression |

Feature 19 updates existing client workflow calls to send returned versions in the same PR, even though full workflow UI/gates belong to 21. Intermediate staging must not leave the Lab 3 UI broken. No DELETE action/history endpoints are exposed; attempted deletion produces safe 404/405, never deletes a record.

## 3. Action DTOs and validation

### Create

```http
POST /api/tickets/42/actions
Content-Type: application/json
Idempotency-Key: 123e4567-e89b-42d3-a456-426614174000
```

```json
{
  "expectedTicketVersion": 7,
  "actionAt": "2026-09-27T09:00:00+07:00",
  "description": "Inspect the network adapter.",
  "result": null,
  "assigneeId": 6,
  "followUpRequired": true,
  "followUpNote": "Obtain requester availability.",
  "attachmentNotes": "Refer to adapter-photo.png in Ticket Attachments."
}
```

| Field | Create | Update | Validation |
| --- | --- | --- | --- |
| expectedTicketVersion | Required | Required | Positive integer; checked against parent |
| expectedVersion | Not accepted | Required | Positive action version |
| actionAt | Required | Optional | ISO instant; ticket.createdAt <= actionAt <= server now + 5 min |
| description | Required | Optional | Trimmed 1-2000 chars |
| result | Optional/null | Optional/null | 0-2000 chars; nonblank required for COMPLETED |
| assigneeId | Optional, default actor | Optional | Active S/A; positive integer, not null |
| followUpRequired | Required | Optional | Boolean; not string/number |
| followUpNote | Conditional | Conditional on resulting record | 1-2000 if true; null/empty if false |
| attachmentNotes | Optional/null | Optional/null | 0-1000 chars; text reference only, no file upload or filesystem resolution |
| status | Not accepted; PLANNED | Optional | Only an allowed edge from current status |
| cancellationReason | Not accepted | Required when cancelling | Trimmed 1-500 chars on cancellation |

Empty PATCH with only versions is rejected. Validate the **resulting record**, not only supplied fields. Fields not supplied remain unchanged, except explicitly clearing follow-up note when the flag becomes false: client must send null or server normalizes existing note to null within the audited update. No silent conversion of nonblank supplied note with false: return validation error. `ticketId`, performed-by and creation time cannot change. Missing optional text is stored null, not whitespace.

Success envelope for create/get/update:

```json
{
  "data": {
    "id": 101,
    "ticketId": 42,
    "actionAt": "2026-09-27T02:00:00.000Z",
    "description": "Inspect the network adapter.",
    "result": null,
    "performedBy": { "id": 5, "name": "Staff A", "role": "IT_STAFF" },
    "assignee": { "id": 6, "name": "Staff B", "role": "IT_STAFF", "isActive": true },
    "followUpRequired": true,
    "followUpNote": "Obtain requester availability.",
    "attachmentNotes": "Refer to adapter-photo.png in Ticket Attachments.",
    "status": "PLANNED",
    "cancellationReason": null,
    "version": 1,
    "updatedBy": { "id": 5, "name": "Staff A", "role": "IT_STAFF" },
    "createdAt": "2026-09-27T02:01:00.000Z",
    "updatedAt": "2026-09-27T02:01:00.000Z"
  },
  "ticketVersion": 8
}
```

Creation adds `Location: /api/tickets/42/actions/101`. Do not expose fingerprint, idempotency key, password/email or private user data in action DTOs. Assignee names may reflect current account names; immutable IDs and revision actors remain the attribution source.

### Update / start / complete / cancel

```json
{
  "expectedTicketVersion": 8,
  "expectedVersion": 1,
  "status": "IN_PROGRESS"
}
```

Completion example (versions must come from a fresh read):

```json
{
  "expectedTicketVersion": 9,
  "expectedVersion": 2,
  "status": "COMPLETED",
  "result": "Replaced the adapter and confirmed connectivity.",
  "followUpRequired": false,
  "followUpNote": null
}
```

Cancellation sends status CANCELLED and cancellationReason; no fabricated completion result is needed. Any staff/admin can make permitted changes; author/assignee-only editing is not a constraint. Inactive assignee must be replaced before start/complete, but cancellation is permitted to retire obsolete work.

### Lists and history

`GET /tickets/:id/actions?page=1&pageSize=10`: defaults 1/10, allowed page sizes 10/25/50; invalid values return 400. Response `{data: ActionDTO[], pagination:{page,pageSize,total,totalPages}, ticketVersion}`; empty totalPages=1 for existing pagination convention. Order actionAt ASC,id ASC. All statuses included for all permitted readers, including cancellation results/reasons.

Action history and ticket history use the same page parameters/envelope without `ticketVersion`; stable createdAt ASC,id ASC. Revision item: `{id,actionId,version,eventType,editor:{id,name,role},snapshot,createdAt}`. Snapshot contains the business fields listed in specification section 7, not transport metadata. Workflow item: `{id,ticketId,kind,actor:{id,name,role},before,after,createdAt}`. Scope public changed owner/priority/status/advisory values; do not embed internal notes or credentials. No fabricated legacy history; return [] plus the UI's “No recorded history” state.

## 4. Transaction, version and retry protocol

1. Authenticate, enforce role/parent ownership, validate input. On action POST, check existing idempotency key under that user/ticket: equivalent normalized business payload returns current action DTO and current parent version with 200 and `Idempotency-Replayed: true`. Changed payload returns 409. Omitted assignee is normalized to creator; exclude expected versions from fingerprint. Replay is not a new edit and does not reapply old state.
2. In one transaction, lock/check the parent ticket and compare expectedTicketVersion; check action expectedVersion where applicable. All action writes and ticket workflow writes share this parent concurrency boundary. Recheck terminal state, assignee eligibility and resolution/cancellation gates inside the transaction.
3. Write snapshot, increment versions, set timestamps and append history together. Uniqueness constraint protects racing duplicate POSTs; re-read the winning key after a uniqueness conflict and apply the replay rules, not a 500.
4. Conflicting versions/serialization retries exhausted return 409 STALE_UPDATE. No partial snapshot, parent version, idempotency or history write survives rollback. Use bounded server retry for transaction serialization failures, never blindly replay an already committed different intent.
5. UI does not overwrite with stale values. Keep local draft, fetch latest record, display differences and require explicit user confirmation to retry with fresh versions. Retry action creation after unknown network outcome with the same key and business payload.

## 5. Existing ticket API increments

- Ticket Detail DTO gains `version`, `resolvedAt`, `reopenedAt`, `resolutionTimeEstimated` and `allowedTransitions` for the authenticated role. AllowedTransitions enumerates matrix edges; additional gate failures are conveyed with a safe explanation.
- Owner request: `{ownerId: number|null, expectedVersion: number}`; priority: `{itPriority: Priority, expectedVersion:number}`; status: `{status:TicketStatus, expectedVersion:number}`.
- Requester advisory request: `{expectedVersion:number}`; response `{requesterResolvedAt,version}`. Repeated already-recorded indication remains 409 ALREADY_RESOLVED, not a formal status change.
- Owner/priority/status continue their existing ticket response shape with new version/timestamps. Preserve owner reassignment, nullable unassigned owner and requester-priority immutability.
- Feature 21 writes history with owner/priority/status/advisory changes and applies all matrix/gate rules. Closing legacy RESOLVED does not require fabricated actions. Reopening clears resolvedAt, sets reopenedAt and resets estimated=false; the prior resolution remains in event history when it was recorded by Lab 4.
- Updating Actions Taken must never invoke a separate unguarded status update. Every endpoint that can affect the gate uses the shared parent transaction.

## 6. Dashboard responses and calculation contract

Dashboard endpoints accept no identity/window overrides; unknown query keys return 400. Compute one `asOf`, Bangkok seven-day boundaries and all metrics within a consistent database read snapshot. Summary items are capped at five. No whole ticket objects, descriptions, internal notes, attachments or credentials in these responses.

Common `TicketPreview`: `{id,ticketNumber,summary,currentStatus,itPriority,ticketOwner:{id,name}|null,updatedAt,resolvedAt,resolutionTimeEstimated,href}`. `href` is a relative `/tickets/:id`. For a requester, only its own ticket previews exist.

Requester response example for an account with no matching tickets (illustrative, not a current result):

```json
{
  "asOf": "2026-09-27T05:00:00.000Z",
  "timeZone": "Asia/Bangkok",
  "window": { "from": "2026-09-20T17:00:00.000Z", "to": "2026-09-27T05:00:00.000Z" },
  "metrics": {
    "open": { "count": 0, "href": "/tickets?dashboardFilter=open" },
    "waiting": { "count": 0, "href": "/tickets?dashboardFilter=waiting" },
    "recentlyResolved": { "count": 0, "href": "/tickets?dashboardFilter=recentlyResolved&from=2026-09-20T17%3A00%3A00.000Z&to=2026-09-27T05%3A00%3A00.000Z" },
    "recentlyUpdated": { "count": 0, "href": "/tickets?dashboardFilter=recentlyUpdated&from=2026-09-20T17%3A00%3A00.000Z&to=2026-09-27T05%3A00%3A00.000Z" }
  },
  "recentTickets": [],
  "recentResolvedTickets": []
}
```

Successful populated responses contain up to five matching TicketPreview items. Arrays are [] when no records match, not a substitute for fetching required previews.

Staff response: same `asOf,timeZone,window`, with:

```text
metrics.unassigned       {count, href}
metrics.ownedByMe        {count, href}
metrics.byStatus         [{status, count, href}]     // all eight enum values
metrics.byPriority       [{itPriority, count, href}] // all four enum values
metrics.recentlyUpdated  {count, href}
myActions                {actionCount, ticketCount, href, items:[ActionPreview]} // max 5
recentTickets            [TicketPreview] // max 5
```

`ActionPreview={id,ticketId,ticketNumber,description,status,actionAt,followUpRequired,href}`; description is capped to 120 characters for preview only, with full text in detail; href `/tickets/:ticketId#action-:id`. Group buckets use enum order from specification, not arbitrary database order. All predicates and orderings are defined in specification section 5. Admin data follows identical staff scope with current admin ID for “my” metrics; requester dashboard called by staff/admin returns 403.

### Drill-down filter additions

| API/list | Allowed dashboardFilter | Exact additional predicate |
| --- | --- | --- |
| `/tickets` / `/tickets` | open, waiting, recentlyResolved, recentlyUpdated | Corresponding R metric; always session requester |
| `/queue` / `/queue` | open, unassigned, ownedByMe, myActions, recentlyUpdated | Corresponding S metric; myActions uses EXISTS active assigned action on active parent, distinct tickets |

Existing queue `status` and `itPriority` filters remain; combine filters with AND. RecentlyResolved/Updated require explicit `from` and `to` ISO instants, from < to; apply from <= timestamp < to. Existing non-dashboard list queries retain existing behavior. Reject unknown dashboardFilter instead of silently showing all records. Non-time filters reject unnecessary from/to. Paginated list totals use the identical predicate as the dashboard metric; canonical recent sort is updatedAt DESC,id DESC, or resolvedAt DESC,id DESC. Queue normal sort retains existing choices but adds id tie-breaker consistently. Links preserve filters in URL and through browser back/reload. Live concurrent data changes may legitimately change totals; show “Updated at” and refresh rather than pretending an expired dashboard snapshot is frozen forever.

## 7. Error envelope and codes

```json
{
  "error": {
    "code": "STALE_UPDATE",
    "message": "This record changed. Reload the latest version before saving.",
    "details": { "currentTicketVersion": 12, "currentVersion": 3 }
  }
}
```

`details` optional, allowlisted, returned only after access checks. Validation details use `{fields:{fieldName:"Safe correction message"}}`; resolution failures use `{reasons:["NO_COMPLETED_ACTION","OPEN_ACTIONS"]}` from the documented reason list. Never leak another user's content.

| HTTP | Code | Condition |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Malformed ID/date/text/boolean/body/filter/pagination or missing versions/key |
| 400 | INVALID_ASSIGNEE | Selected assignee missing, inactive or not staff/admin |
| 400 | INVALID_TRANSITION | Action/ticket edge not in matrix, including no-op status |
| 401 | UNAUTHENTICATED | Missing/expired/invalid session; UI sends safe local return URL to login |
| 403 | FORBIDDEN | Wrong role/ownership; no content disclosure |
| 403 | PASSWORD_CHANGE_REQUIRED / ACCOUNT_INACTIVE | Existing auth guards |
| 404 | NOT_FOUND | Missing entity, wrong nested parent, unavailable removed attachment |
| 409 | STALE_UPDATE | Action/ticket version mismatch or concurrent write conflict |
| 409 | IDEMPOTENCY_CONFLICT | Same actor/ticket/key reused with different business payload |
| 409 | ACTION_READ_ONLY | Terminal action or terminal parent prevents action mutation |
| 409 | RESOLUTION_BLOCKED | OWNER_REQUIRED, OWNER_INACTIVE, NO_COMPLETED_ACTION, OPEN_ACTIONS, FOLLOW_UP_OUTSTANDING, FRESH_WORK_REQUIRED |
| 409 | CANCELLATION_BLOCKED | Parent ticket still has active actions |
| 409 | ALREADY_RESOLVED | Existing once-only requester advisory indication |
| 413 | PAYLOAD_TOO_LARGE | New endpoint body limit exceeded |
| 429 | Existing login rate-limit response | Credential-throttling regression; keep Retry-After |
| 500 | INTERNAL_ERROR | Generic safe error; log sanitized correlation information, not secrets |

Validation or gate failure creates zero writes. A role-forbidden action write is 403 even if a body asks an invalid transition. Missing version is 400; stale version is 409. Tests assert HTTP and code, not fragile full human-readable messages.

## 8. Retained API regression inventory

No resurrected `/api/requesters` endpoint. Verify `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/change-password`; requester `/tickets` create/list/detail; attachment upload/download/soft-remove; `/queue` and `/queue/owners`; owner/priority/status/advisory; public comment GET/POST; internal note GET/POST; admin user GET/POST/PATCH/set-password; categories, related systems and health. Preserve requester-only ticket creation, server-generated one-time temporary passwords, self/last-admin protections, generic authentication errors, safe attachment filenames/path checks, file authorization and existing upload limits. Full historical DTOs remain in the Lab 2/3 contracts unless specifically superseded above.
