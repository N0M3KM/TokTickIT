# TokTickIT — Lab 1

A small full-stack vertical slice for CPE 334. It shows the TokTickIT service status and the four supported IT request categories.

## Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma

## Setup

```bash
npm install
copy .env.example server/.env
# Edit server/.env with your PostgreSQL credentials
npm run prisma:migrate --workspace=server
npm run prisma:seed --workspace=server
```

Start the server and client in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

Open the Vite URL (normally http://localhost:5173), then click **Check System**.

## Tests

```bash
npm test
```
