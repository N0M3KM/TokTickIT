# TokTickIT - Lab 1

TokTickIT is an IT Service Desk application. Lab 1 delivers a small but complete full-stack vertical slice: a React page calls an Express REST API, the API reads request categories through Prisma, and PostgreSQL stores the category data.

## Lab 1 working result

Open the frontend and select **Check System**.

- The app calls `GET /api/health` and displays **System Status: Online** when the API responds successfully.
- The app calls `GET /api/categories` and displays the four categories loaded from PostgreSQL:
  1. Account and Access
  2. Hardware
  3. Software
  4. Network
- A loading state appears while the requests are in progress.
- A useful Offline message appears if the backend or database is unavailable.

## Technology stack

| Area | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Bootstrap |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma |
| API style | REST |
| Automated tests | Vitest and Supertest |

## Prerequisites

- Node.js 20 or later
- PostgreSQL running locally
- A database named `toktickit`

## Setup

1. Install project dependencies from the repository root.

   ```powershell
   npm install
   ```

2. Create your local database configuration. This file is ignored by Git, so credentials are never committed.

   ```powershell
   Copy-Item server\.env.example server\.env
   ```

3. Edit `server/.env` and set your own PostgreSQL password.

   ```env
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/toktickit?schema=public"
   ```

4. Create the Category table and seed the required records.

   ```powershell
   npm run prisma:migrate --workspace=server
   npm run prisma:seed --workspace=server
   ```

5. Start the backend and frontend in separate terminals.

   ```powershell
   npm run dev:server
   ```

   ```powershell
   npm run dev:client
   ```

6. Open the Vite URL shown in the terminal (normally `http://localhost:5173`) and select **Check System**.

## REST endpoints

### Health check

`GET /api/health`

```json
{ "status": "ok", "service": "TokTickIT API" }
```

### Category list

`GET /api/categories`

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

## Automated tests and build

Run all Vitest and Supertest tests:

```powershell
npm test
```

Build both frontend and backend:

```powershell
npm run build
```

See [`docs/lab-01/tests.md`](docs/lab-01/tests.md) for the complete test inventory and expected evidence.

## Repository structure

```text
toktickit/
├── client/
├── server/
│   ├── prisma/
│   ├── src/
│   └── tests/lab-01/
├── docs/lab-01/
│   ├── ai_use.md
│   ├── reviewer.md
│   └── tests.md
├── .env.example
├── .gitignore
└── README.md
```

## Git and review workflow

Use `main` as the stable branch, `lab1-staging` as the Lab 1 integration branch, and the four specified feature branches for implementation. Do not commit passwords, `.env` files, or `node_modules`. Record peer-review evidence in [`docs/lab-01/reviewer.md`](docs/lab-01/reviewer.md).
