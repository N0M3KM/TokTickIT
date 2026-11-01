import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';

if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner') throw new Error('Use npm run test:requester-dashboard-browser.');
const workspace = resolve(import.meta.dirname, '..');
const prisma = new PrismaClient();
const children = [];
const port = () => new Promise((accept, reject) => {
  const probe = createServer(); probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => accept(value)); });
});
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: 'inherit' });
  children.push(child); return child;
}
async function ready(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise(accept => setTimeout(accept, 200));
  }
  throw new Error('Isolated dashboard server did not become ready.');
}
try {
  const password = 'Synthetic-Dashboard-Only-42!';
  const passwordHash = await bcrypt.hash(password, 4);
  const account = (name, role) => prisma.user.create({ data: { name, email: `${name}@test.invalid`, role, passwordHash, mustChangePassword: false } });
  const requester = await account('dashboard-requester', 'REQUESTER');
  const empty = await account('dashboard-empty', 'REQUESTER');
  const other = await account('dashboard-other', 'REQUESTER');
  const staff = await account('dashboard-staff', 'IT_STAFF');
  const admin = await account('dashboard-admin', 'ADMINISTRATOR');
  const category = await prisma.category.create({ data: { name: 'Dashboard browser fixtures' } });
  const recent = new Date(Date.now() - 60_000), older = new Date(Date.now() - 20 * 86400_000);
  const statuses = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED', ...Array(6).fill('NEW')];
  for (const [index, status] of statuses.entries()) await prisma.ticket.create({ data: {
    ticketNumber: `DASH-${index + 1}`, requesterId: requester.id, ticketOwnerId: staff.id, categoryId: category.id,
    summary: `Dashboard support request ${index + 1}`, description: 'PRIVATE_DESCRIPTION_NOT_IN_DASHBOARD', currentStatus: status,
    createdAt: older, updatedAt: recent, resolvedAt: ['RESOLVED', 'CLOSED'].includes(status) ? recent : null,
    resolutionTimeEstimated: status === 'CLOSED',
  } });
  await prisma.ticket.create({ data: { ticketNumber: 'DASH-OLDER', requesterId: requester.id, categoryId: category.id, summary: 'Older closed request', description: 'Older fixture', currentStatus: 'CLOSED', resolvedAt: older, createdAt: older, updatedAt: older, resolutionTimeEstimated: true } });
  await prisma.ticket.create({ data: { ticketNumber: 'FOREIGN', requesterId: other.id, categoryId: category.id, summary: 'OTHER_ACCOUNT_SECRET', description: 'Foreign fixture', updatedAt: recent } });
  const apiPort = await port(), browserPort = await port();
  const env = { ...process.env, PORT: String(apiPort), API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${browserPort}`, DASHBOARD_BROWSER_PASSWORD: password,
    DASHBOARD_REQUESTER_ID: String(requester.id), DASHBOARD_REQUESTER_EMAIL: requester.email,
    DASHBOARD_EMPTY_EMAIL: empty.email, DASHBOARD_STAFF_EMAIL: staff.email, DASHBOARD_ADMIN_EMAIL: admin.email,
  };
  start(['--import', 'tsx', 'src/server.ts'], join(workspace, 'server'), env);
  start(['node_modules/vite/bin/vite.js', 'client', '--host', '127.0.0.1', '--port', String(browserPort), '--strictPort'], workspace, env);
  await Promise.all([ready(`http://127.0.0.1:${apiPort}/api/health`), ready(env.PLAYWRIGHT_BASE_URL)]);
  const tests = start(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.dashboard.config.ts'], workspace, env);
  process.exitCode = await new Promise((accept, reject) => { tests.once('error', reject); tests.once('exit', code => accept(code ?? 1)); });
} finally {
  for (const child of children.reverse()) if (child.exitCode === null) child.kill();
  await prisma.$disconnect();
}
