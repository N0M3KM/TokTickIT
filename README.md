# TokTickIT

TokTickIT is an IT Service Desk application.

- **Lab 1** delivers a full-stack vertical slice: React frontend, Express REST API, Prisma ORM, and PostgreSQL database with category data.
- **Lab 2** delivers the Requester-facing ticketing MVP: Development Requester Selection, Create Ticket, My Tickets, Ticket Detail, and Attachment lifecycle — all with a consistent Zen Green UI theme.

---

## Lab 2 Working Result

Select a Development Requester to simulate login, then:

- **Create Ticket** — fill category, related system, priority, summary, description, and optional attachments. The backend generates a unique Ticket Number (`TKT-YYYY-NNNNNN`).
- **My Tickets** — view, search, filter (category / priority / status), sort, and paginate your own tickets. Cross-requester access is blocked.
- **Ticket Detail** — read-only ticket fields; upload, download, and soft-remove attachments with a required reason.
- **Zen Green UI** — consistent color tokens, responsive at desktop ≥ 992 px, tablet 768–991 px, and mobile < 768 px.

## Lab 1 Working Result

Open the frontend and select **Check System**.

- `GET /api/health` → **System Status: Online**
- `GET /api/categories` → four categories loaded from PostgreSQL
- Loading and Offline states handled.

---

## Technology Stack

| Area | Technology |
|------|-----------|
| Frontend | React 18, TypeScript, Vite, Bootstrap 5 |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| API style | REST |
| Automated tests | Vitest, Supertest, React Testing Library |
| E2E / Responsive | Playwright |

---

## Prerequisites

- Node.js 20 or later
- Docker Desktop (recommended) **or** PostgreSQL 16 running locally
- A database named `toktickit`

---

## Setup

### Option A — Docker Compose (recommended)

```powershell
# 1. Copy root env file
Copy-Item .env.example .env

# 2. Start all services (PostgreSQL + server + client)
docker-compose up -d

# 3. Run migrations and seed (first time only)
npm run prisma:migrate --workspace=server
npm run prisma:seed   --workspace=server
```

Open `http://localhost:5173`.

### Option B — Local Node.js

```powershell
# 1. Install all dependencies
npm install

# 2. Configure server database connection
Copy-Item server\.env.example server\.env
# Edit server\.env → set DATABASE_URL to your PostgreSQL instance

# 3. Run migrations and seed
npm run prisma:migrate --workspace=server
npm run prisma:seed   --workspace=server

# 4. Start backend (terminal 1)
npm run dev:server

# 5. Start frontend (terminal 2)
npm run dev:client
```

Open `http://localhost:5173`.

---

## REST Endpoints

### Reference data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/categories` | Active ticket categories |
| GET | `/api/related-systems` | Active related systems |
| GET | `/api/requesters` | Active Development Requesters |

### Tickets
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tickets` | Create a ticket (returns Ticket Number) |
| GET | `/api/tickets?requesterId=&search=&page=` | List requester's tickets (paginated) |
| GET | `/api/tickets/:id?requesterId=` | Get one owned ticket with attachments |

### Attachments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tickets/:id/attachments` | Upload attachment (JPG/PNG/WEBP/PDF, max 5 MB) |
| GET | `/api/tickets/:id/attachments/:aid/download` | Download active attachment |
| DELETE | `/api/tickets/:id/attachments/:aid` | Soft-remove attachment (reason required) |

---

## Automated Tests

### Run all server tests (unit + API)

```powershell
cd server
npm test
# Expected: 13 test files, 113 tests passed
```

### Run all client tests (UI component + style)

```powershell
cd client
npm test
# Expected: 7 test files, 104 tests passed
```

### Run E2E and responsive tests (requires running app)

```powershell
npx playwright test e2e/lab-02/
```

See [`docs/lab-02/tests.md`](docs/lab-02/tests.md) for the complete test inventory, AC traceability, and expected evidence.

---

## Repository Structure

```text
TokTickIT/
├── client/
│   └── src/
│       ├── components/        # AppShell, Badge, AttachmentSection, ConfirmDialog, etc.
│       ├── context/           # RequesterContext (localStorage-backed dev requester)
│       ├── lab-02/            # UI component and style tests
│       ├── pages/             # CreateTicket, MyTickets, TicketDetail, RequesterSelector
│       └── styles/            # tokens.css (Zen Green design tokens)
├── docs/
│   ├── lab-01/                # Lab 1 documentation
│   └── lab-02/                # specification.md, tests.md, ui-spec.md, api-spec.md,
│                              # reviewer.md, ai-use.md, instructions.md
├── e2e/
│   └── lab-02/                # Playwright E2E and responsive tests
├── server/
│   ├── prisma/                # schema.prisma, seed.ts, migrations/
│   ├── src/
│   │   ├── lib/               # ticketNumber, ticketValidation, attachmentValidation, upload
│   │   └── routes/            # categories, requesters, relatedSystems, tickets, attachments
│   └── tests/
│       ├── lab-01/            # Lab 1 API tests
│       └── lab-02/            # Lab 2 unit + API tests
├── artifacts/lab-02/          # Screenshots from visual inspection
├── playwright.config.ts
├── .env.example
├── .gitignore
└── README.md
```

---

## Git and Review Workflow

- `main` — stable release branch (Lab 1 complete; Lab 2 pending release PR)
- `lab2-staging` — Lab 2 integration branch; all feature PRs merge here first
- `feature/N-description` — one branch per issue

Do not commit passwords, `.env` files, or `node_modules`. Record peer-review evidence in [`docs/lab-02/reviewer.md`](docs/lab-02/reviewer.md).
