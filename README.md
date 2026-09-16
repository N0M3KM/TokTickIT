# TokTickIT

TokTickIT is an IT Service Desk application built with React, TypeScript, Express, Prisma, and PostgreSQL.

## Lab 1 Working Result

Open the frontend and select **Check System**.

- `GET /api/health` → **System Status: Online**
- `GET /api/categories` → four categories loaded from PostgreSQL
- Loading and Offline states handled.

## Lab 2 Working Result

Select a Development Requester to simulate login, then:

- **Create Ticket** — fill category, related system, priority, summary, description, and optional attachments. The backend generates a unique Ticket Number (`TKT-YYYY-NNNNNN`).
- **My Tickets** — view, search, filter (category / priority / status), sort, and paginate your own tickets. Cross-requester access is blocked.
- **Ticket Detail** — read-only ticket fields; upload, download, and soft-remove attachments with a required reason.
- **Zen Green UI** — consistent color tokens, responsive at desktop ≥ 992 px, tablet 768–991 px, and mobile < 768 px.

## Lab 3 overview

Lab 3 replaces the Lab 2 Development Requester selector with real authentication. Open the application and **Sign In** with a seeded account or an account created by an administrator.

| Area | Features |
| --- | --- |
| Authentication | Email/password login, HTTP-only session cookie, session restoration, Sign Out, login throttling, role-based navigation, and safe return to the requested page after login. |
| Change Password | Current password, new password, confirmation, show/hide controls, live complexity checklist, same-password and mismatch errors, saving/error feedback. Initial-password users must finish this step before opening application screens; refreshing preserves the session. Signed-in users can also change their password from the header. |
| Requester | Create Ticket, search/filter/sort/paginate My Tickets, view owned ticket details, manage attachments, post public comments, and indicate that a problem appears resolved. |
| IT Staff | Shared Ticket Queue, search/filter/sort/pagination, desktop table and smaller-screen cards, open ticket details, assign/reassign ownership, set IT Priority, follow permitted status transitions, post comments, and add private internal notes. |
| Administrator | List/search/filter accounts, create and edit users, assign one role, activate/deactivate accounts, generate a temporary password, and enforce self-deactivation/last-administrator safeguards. |
| Password recovery | **Forgot password?** explains administrator-assisted recovery. The administrator generates a new temporary password, shown once, which the user must change at the next login. |
| Account creation | **Need an account?** explains how to contact the administrator. Public self-registration and reset-password emails are excluded by the Lab 3 sheet, section 4.2. |
| Zen Green UI | Primary `#006B3C`, hover `#005530`, pale green `#EAF6EF`, page `#F5F7F6`, white surfaces, semantic role/status badges, responsive layouts, and visible keyboard focus. |

Public comments are visible to the ticket requester and support team. Internal notes are restricted to IT Staff/Administrators. Requesters cannot formally resolve or close a ticket. The API enforces roles and ownership independently of the UI.

### Screens and role destinations

| Route | Purpose |
| --- | --- |
| `/login` | Sign in |
| `/forgot-password` | Administrator-assisted recovery instructions |
| `/sign-up` | Account-request instructions; no public registration form |
| `/change-password` | Mandatory initial-password change or voluntary password change |
| `/tickets`, `/tickets/new` | Requester ticket list and creation |
| `/tickets/:id` | Authorized ticket details, discussions, attachments, and workflow |
| `/queue` | IT Staff/Administrator queue |
| `/admin/users` | Administrator user management |

After sign-in, Requesters go to My Tickets, IT Staff go to Ticket Queue, and Administrators go to User Management. Initial-password users go to Change Password first.

## Seeded accounts — local development only

These are the initial credentials in `server/prisma/seed.ts`. Do not use these sample passwords in production or commit real user passwords, session cookies, or JWT secrets.

### Requester email addresses and passwords

| Name | Email | Initial password | State |
| --- | --- | --- | --- |
| Somchai Jaidee | `somchai.j@example.com` | `Change@123` | Active; must change password on first login |
| Nattaporn Srisuk | `nattaporn.s@example.com` | `Change@123` | Active; must change password on first login |
| Wiroj Tanaka | `wiroj.t@example.com` | `Change@123` | Active; must change password on first login |
| Araya Phongphan | `araya.p@example.com` | `Change@123` | Active; must change password on first login |
| Prayut Mahachai | `prayut.m@example.com` | `Change@123` | Inactive; cannot sign in |

### Staff and administrator credentials

| Role | Email | Initial password | State |
| --- | --- | --- | --- |
| IT Staff | `michael.b@example.com` | `Staff@123!` | Active |
| IT Staff | `sarah.j@example.com` | `Staff@123!` | Active |
| IT Staff | `david.l@example.com` | `Staff@123!` | Active |
| IT Staff | `kevin.p@example.com` | `Staff@123!` | Inactive |
| Administrator | `admin@example.com` | `Admin@123!` | Active |

**Already changed your password?** Use the password you chose. Re-running the seed preserves existing password hashes; it does not restore the initial passwords. An administrator can use **Generate Reset Password** on the user's edit form when recovery is needed. The generated password is shown once and is not saved in the README.

### First-login walkthrough

1. Sign in as an active requester using the initial credentials above.
2. On **Change Your Password**, enter the current temporary password.
3. Choose a different password containing at least 8 characters, uppercase, lowercase, a number, and a special character.
4. Confirm it and select **Save Password and Continue**.
5. Create or view your tickets. Use **Sign Out** in the header to end the session.

## Setup

Requires Node.js 20+, Docker Desktop or PostgreSQL 16, and a configured database.

Run commands from the repository containing this README, `client/`, and `server/`. The active development branch is `feature/17-lab3-e2e-and-release`; the earlier `feature/13-17` branch still contains the Lab 2 client.

### Local API and client

```powershell
npm install
# Copy only if the files do not already exist; preserve your current settings.
Copy-Item server\.env.example server\.env
# Set DATABASE_URL and a random JWT_SECRET in server\.env.
npm exec --workspace=server -- prisma migrate deploy
npm run prisma:seed --workspace=server

# Terminal 1
npm run dev:server
# Terminal 2
npm run dev:client
```

The API uses port **3001**. Open the URL printed by Vite (normally `http://localhost:5173`). Vite proxies `/api` to `http://localhost:3001`, so session cookies remain on the same browser origin.

### All services in Docker

Configure root `.env` with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `JWT_SECRET` before starting Docker. Stop any host API already occupying port 3001.

```powershell
docker compose up -d --build
```

The server startup applies pending migrations and seeds development accounts. Existing database volumes are retained. The client proxies to `http://server:3001`.

### Docker client with an API running on Windows

For the mixed development setup, keep `npm run dev:server` running on Windows and use:

```powershell
docker compose -p toktickit -f docker-compose.yml -f docker-compose.native-api.yml up -d --build --no-deps client
```

This uses `http://host.docker.internal:3001` inside the client container. Open `http://localhost:5173/login`. The client Dockerfile forwards `--host 0.0.0.0` directly to Vite so the published port is reachable.

### Still seeing the Development Requester selector?

That screen belongs to the old Lab 2 client. Check `git branch --show-current`, start from the correct repository, and rebuild the Docker client with `--build`. Containers contain a snapshot of source code; switching branches alone does not update them. Refresh the browser after the rebuild.

## API overview

Except for health/login, endpoints require authentication; application endpoints also require completion of the initial-password change. The current-user endpoint remains accessible during that change so refresh can restore the session.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Public health check |
| POST | `/api/auth/login` | Sign in; rate-limited failed attempts |
| POST | `/api/auth/logout` | Invalidate token and clear cookie |
| GET | `/api/auth/me` | Restore the signed-in identity |
| POST | `/api/auth/change-password` | Validate and save a new password |
| GET | `/api/categories`, `/api/related-systems` | Authenticated reference data |
| GET / POST | `/api/tickets` | List own tickets / create as the authenticated requester |
| GET | `/api/tickets/:id` | Authorized ticket detail |
| POST / GET / DELETE | `/api/tickets/:id/attachments/...` | Upload, download, soft-remove attachments |
| GET | `/api/queue`, `/api/queue/owners` | Staff queue / active eligible ticket owners |
| PATCH | `/api/tickets/:id/owner`, `/it-priority`, `/status` | Staff workflow changes |
| GET / POST | `/api/tickets/:id/comments`, `/notes` | Public comments / restricted internal notes |
| POST | `/api/tickets/:id/requester-resolved` | Requester resolution indication |
| GET / POST | `/api/users` | Administrator list / create users |
| PATCH | `/api/users/:id` | Administrator edit account |
| POST | `/api/users/:id/set-password` | Generate a one-time temporary password |

`/api/requesters` is removed. Client-supplied `requesterId` no longer determines identity.

## Verification

```powershell
npm run build
npm run test --workspace=client -- src/lab-03
npm run test --workspace=server -- tests/lab-03
# Requires running app and a Playwright browser:
npx playwright test e2e/lab-03/working-ui.spec.ts --project=desktop
```

If Prisma generation fails because the running Windows API holds its DLL open, run `npx vitest run tests/lab-03` from `server/` using the existing generated client, or stop the API before regenerating.

For an installed Chrome browser, set `$env:PLAYWRIGHT_CHANNEL='chrome'` before running Playwright. Use `PLAYWRIGHT_BASE_URL` to test a different client port. The workflow test creates a dedicated verification account and ticket and uses the real API.

**Verification status:** Client/server builds, 18 focused authentication UI tests (including 7 Change Password tests), and 59 Lab 3 server tests passed. The installed-Chrome Zen Green check passed for login and mandatory Change Password, including mobile overflow and computed button colors; this check mocks authentication and does not prove database integration. The real API browser workflow remains unverified because Docker's engine is failing to start/respond. Historical Lab 2 regression tests also need migration to authenticated fixtures. Do not treat these results as proof that every Lab 3 acceptance criterion has passed. See [Lab 3 tests](docs/lab-03/tests.md) for scope and remaining checks.

## Engineering documents and workflow

- [Specification](docs/lab-03/specification.md)
- [UI specification](docs/lab-03/ui-spec.md)
- [API specification](docs/lab-03/api-spec.md)
- [Tests and traceability](docs/lab-03/tests.md)
- [Peer review](docs/lab-03/reviewer.md)
- [AI use record](docs/lab-03/ai-use.md)

Branch flow: `main → lab3-staging → feature/*`. Review feature branches before integration; this update does not merge or publish a release.

Lab 1 and Lab 2 documents remain under `docs/lab-01/` and `docs/lab-02/` as historical records. Lab 3 uses authenticated identity in place of their development-only selector.
