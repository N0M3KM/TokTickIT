import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';

if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner') throw new Error('Use npm run test:staff-dashboard-browser.');
const workspace = resolve(import.meta.dirname, '..');
const prisma = new PrismaClient(), children = [];
const availablePort = () => new Promise((accept, reject) => {
  const probe = createServer(); probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => accept(port)); });
});
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: 'inherit' }); children.push(child); return child;
}
async function ready(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise(accept => setTimeout(accept, 200));
  }
  throw new Error('Isolated staff dashboard server did not become ready.');
}
try {
  const password = 'Synthetic-Staff-Dashboard-42!', passwordHash = await bcrypt.hash(password, 4);
  const account = (name, role) => prisma.user.create({ data: { name, email: `${name}@test.invalid`, role, passwordHash, mustChangePassword: false } });
  const staff = await account('staff-browser', 'IT_STAFF'), performer = await account('performer-browser', 'IT_STAFF');
  const admin = await account('admin-browser', 'ADMINISTRATOR'), empty = await account('empty-staff-browser', 'IT_STAFF');
  const requester = await account('requester-staff-browser', 'REQUESTER');
  const category = await prisma.category.create({ data: { name: 'Staff dashboard browser fixtures' } });
  const older = new Date(Date.now() - 20 * 86400_000), recent = new Date(Date.now() - 60_000);
  const tickets = [];
  const statuses = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED', ...Array(12).fill('NEW')];
  for (const [index, currentStatus] of statuses.entries()) tickets.push(await prisma.ticket.create({ data: {
    ticketNumber: `STAFF-${index + 1}`, requesterId: requester.id, ticketOwnerId: index === 0 ? null : index === 2 ? performer.id : staff.id,
    categoryId: category.id, summary: `Staff support request ${index + 1}`, description: 'PRIVATE_TICKET_DESCRIPTION', currentStatus,
    itPriority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][index % 4], createdAt: older, updatedAt: recent,
    resolvedAt: ['RESOLVED', 'CLOSED'].includes(currentStatus) ? recent : null,
  } }));
  const parent = tickets[2];
  const action = (assigneeId, status, index, description) => prisma.actionTaken.create({ data: {
    ticketId: parent.id, performedById: performer.id, assigneeId, updatedById: performer.id,
    actionAt: new Date(older.getTime() + (index + 1) * 60_000), description, status,
    result: status === 'COMPLETED' ? 'Historical completed work' : null,
    idempotencyKey: randomUUID(), requestFingerprint: 'browser-fixture', createdAt: older,
  } });
  for (let index = 0; index < 10; index++) await action(performer.id, 'COMPLETED', index, `Earlier completed action ${index + 1}`);
  const linked = await action(staff.id, 'PLANNED', 10, `Assigned investigation ${'long shared action text '.repeat(12)}`);
  await action(staff.id, 'IN_PROGRESS', 11, 'Second assigned investigation on the same parent');
  await action(admin.id, 'PLANNED', 12, 'Administrator assigned investigation');
  const apiPort = await availablePort(), browserPort = await availablePort();
  const env = { ...process.env, PORT: String(apiPort), API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${browserPort}`, STAFF_BROWSER_PASSWORD: password,
    STAFF_BROWSER_EMAIL: staff.email, STAFF_BROWSER_ID: String(staff.id), STAFF_BROWSER_ADMIN_EMAIL: admin.email,
    STAFF_BROWSER_ADMIN_ID: String(admin.id), STAFF_BROWSER_EMPTY_EMAIL: empty.email,
    STAFF_BROWSER_REQUESTER_EMAIL: requester.email, STAFF_BROWSER_ACTION_ID: String(linked.id), STAFF_BROWSER_TICKET_ID: String(parent.id),
  };
  start(['--import', 'tsx', 'src/server.ts'], join(workspace, 'server'), env);
  start(['node_modules/vite/bin/vite.js', 'client', '--host', '127.0.0.1', '--port', String(browserPort), '--strictPort'], workspace, env);
  await Promise.all([ready(`http://127.0.0.1:${apiPort}/api/health`), ready(env.PLAYWRIGHT_BASE_URL)]);
  const tests = start(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.staff-dashboard.config.ts'], workspace, env);
  process.exitCode = await new Promise((accept, reject) => { tests.once('error', reject); tests.once('exit', code => accept(code ?? 1)); });
} finally {
  for (const child of children.reverse()) if (child.exitCode === null) child.kill();
  await prisma.$disconnect();
}
