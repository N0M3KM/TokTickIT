# Lab 1 test evidence

Run the complete automated suite from the repository root:

```powershell
npm test
```

Build both applications for an additional verification check:

```powershell
npm run build
```

## Automated test inventory

| ID | Test file | Tool | Test description | Expected result |
|---|---|---|---|---|
| API-01 | `server/tests/lab-01/health.test.ts` | Vitest + Supertest | `GET /api/health` returns HTTP 200 and the exact required JSON. | Pass |
| API-02 | `server/tests/lab-01/categories.test.ts` | Vitest + Supertest | `GET /api/categories` returns the four expected `{ id, name }` objects and Prisma is queried in ascending ID order. | Pass |
| DB-01 | `server/tests/lab-01/category-seed.test.ts` | Vitest | The seed-data module defines the four required IT request category names. | Pass |
| UI-01 | `client/src/App.test.tsx` | Vitest + React Testing Library | The TokTickIT heading renders. | Pass |
| UI-02 | `client/src/App.test.tsx` | Vitest + React Testing Library | The UI shows Loading, then displays Online and the complete category list returned by the API. | Pass |
| UI-03 | `client/src/App.test.tsx` | Vitest + React Testing Library | An unavailable API displays the useful Offline error message. | Pass |

## Manual functional checks for the app demo

These checks use the real local PostgreSQL database after migration and seeding.

| ID | Action | Expected result |
|---|---|---|
| MAN-01 | Open the frontend and select **Check System**. | The button shows a loading state while requests are pending. |
| MAN-02 | Allow both APIs and PostgreSQL to run. | **System Status: Online** and all four numbered categories appear. |
| MAN-03 | Stop the backend or make PostgreSQL unavailable, then select **Check System**. | **System Status: Offline** and `Unable to connect to TokTickIT API.` appear. |
| MAN-04 | Run `npm run prisma:seed --workspace=server` more than once. | The four categories remain unique; no duplicates are inserted. |

