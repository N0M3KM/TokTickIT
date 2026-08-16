# Lab 1 peer-review evidence

## My reviewer

| Field | Details |
|---|---|
| All reviewer name | `นายจิณณกันต์ เฉวียงภพ / นายรัฐธรรมนูญ บูรณพัฒนา / นายสิทธิชัย ภิรมย์ปั่น` |
| All reviewer student ID | `67070501010 / 67070501037 / 67070501074` |
| All reviewer GitHub username | `@Jinnakan / @TauForge / @Bank848` |

## Submitted pull requests reviewed by my peer

| Lab 1 issue | Pull request link | Reviewer approval link |
|---|---|---|
| Feature 1: project foundation- #5 | `https://github.com/N0M3KM/TokTickIT/pull/5` | `https://github.com/N0M3KM/TokTickIT/pull/5#issuecomment-5180457979` |
| Feature 2: add API health check #6 | `https://github.com/N0M3KM/TokTickIT/pull/6` | `https://github.com/N0M3KM/TokTickIT/pull/6#pullrequestreview-4925618168` |
| Feature 3: seed IT request categories #7 | `https://github.com/N0M3KM/TokTickIT/pull/7` | `https://github.com/N0M3KM/TokTickIT/pull/7#pullrequestreview-4925467217` |
| Feature 4: Category list #9 | `https://github.com/N0M3KM/TokTickIT/pull/9` | `https://github.com/N0M3KM/TokTickIT/pull/9#pullrequestreview-4935472930` |

## Feedback received from my reviewer

### Pull request: `Feature 1: project foundation- #5 (https://github.com/N0M3KM/TokTickIT/pull/5)`

- **Jinnakan's comment:**
  > `React, TypeScript, Vite, and Bootstrap are set up. Also, Bootstrap CSS is imported and Bootstrap classes are used. Express and TypeScript backend structure is checked. Prisma schema, migration, and seed file are all checked. Vitest and Supertest are configured. .gitignore, .env.example, and README are checked. Finally, frontend and backend tests pass.`
- **My response:**
  > `Thank you for your review and your verification of my work.`

### Pull request: `Feature 2: add API health check- #6 (https://github.com/N0M3KM/TokTickIT/pull/6)`

- **Bank848's comment:**
  > `small clean change just pulls the response into a named constant and formats the test file. health endpoint still returns exactly what's required. approving.`
- **My response:**
  > `Did respond by leaving a like on the approval`

- **Jinnakan's comment:**
  > `The health API is responding and matching with the required JSON. The health response constant is clear and avoids repeated hard-coded values. It has category endpoint which is fine. The frontend already has health calls, but it is not changed or tested by this PR, worth check if the backend and frontend both work together. No critical issue. Good job man.`
- **My response:**
  > `Did respond by leaving a like on the approval`

### Pull request: `Feature 3: seed IT request categories- #7 (https://github.com/N0M3KM/TokTickIT/pull/7)`

- **Bank848's comment:**
  > `category names moved into their own file and the seed still uses upsert so reruns stay safe. approving.`
- **My response:**
  > `Did respond by leaving a like on the approval`

### Pull request: `Feature 4: Category list- #9 (https://github.com/N0M3KM/TokTickIT/pull/9)`

- **TauForge's comment:**
  > `LGTM. Checked the category list, API integration, UI states, and tests. Everything looks good and matches the requirements. No issues from my side. Approved.`
- **My response:**
  > `Thank you for your review and your verification of my work.`

## Peer review I gave to my partner

| Field | Details |
|---|---|
| Partner name | `นายจิณณกันต์ เฉวียงภพ / นายสิทธิชัย ภิรมย์ปั่น` |
| Partner student ID | `67070501010 / 67070501074` |
| Partner GitHub username | `@Jinnakan / @Bank848` |

### My review comment on Jinnakan's PR:

- **My comment on https://github.com/Jinnakan/TokTickIT/pull/6:**
  > `The client-side fetch logic is well done with Promise.all used effectively for concurrent requests and clear loading, online, and offline states. The application logic functions as expected, well done :)`
- **Evidence link:** `https://github.com/Jinnakan/TokTickIT/pull/6#issuecomment-5180450024`

- **My comment on https://github.com/Jinnakan/TokTickIT/pull/7:**
  > `Everything seems to meet the conditions from issue #2. /api/health is correctly implemented and passes its Supertest suite.`
- **Evidence link:** `https://github.com/Jinnakan/TokTickIT/pull/7#pullrequestreview-4905165507`

### My review comment on Bank848's PR:

- **My comment on https://github.com/Bank848/toktickit/pull/5:**
  > `The code is clean and organized, but I have a small request. According to the required repository structure, the tests/lab-01 directory should be inside the server folder. It looks like this commit is missing those folders. Could you please add them? Or, if you plan to add them in a future commit, just let me know. Thanks :)`
- **Evidence link:** `https://github.com/Bank848/toktickit/pull/5#pullrequestreview-4925662684`
- **Bank848's response:** 
  > `Thanks both for the review — addressed in 21ce25a: Added a server smoke test at server/tests/lab-01/app.test.ts (mirrors the tests/lab-01 structure already used on the client side) so npm run test in server/ actually runs something and exercises the Express app via supertest. Fixed the README: removed the npx prisma db seed step and the Check System / category-loading description, since neither the seed script nor that UI exists in this foundation PR. Left a note that seeding lands in the category seed PR. Requesting re-review.`
