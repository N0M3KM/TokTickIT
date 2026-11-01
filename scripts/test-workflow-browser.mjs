import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';

// Invoked only by the disposable database runner; never use an application DB.
if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner') throw new Error('Use npm run test:workflow-browser.');
const workspace = resolve(import.meta.dirname, '..');
const prisma = new PrismaClient();
const children = [];
const availablePort = () => new Promise((accept, reject) => {
  const probe = createServer(); probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => accept(port)); });
});
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: 'inherit' });
  children.push(child); return child;
}
async function ready(url) {
  for (let count = 0; count < 100; count++) {
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise(accept => setTimeout(accept, 200));
  }
  throw new Error('The isolated browser server did not become ready.');
}
try {
  const password = 'Synthetic-Browser-Only-42!';
  const passwordHash = await bcrypt.hash(password, 4);
  const staff = await prisma.user.create({ data: { name: 'Workflow Staff', email: 'browser-staff@test.invalid', role: 'IT_STAFF', passwordHash, mustChangePassword: false } });
  const requester = await prisma.user.create({ data: { name: 'Workflow Requester', email: 'browser-requester@test.invalid', role: 'REQUESTER', passwordHash, mustChangePassword: false } });
  const category = await prisma.category.create({ data: { name: 'Browser workflow fixtures' } });
  const ids = {};
  for (const viewport of ['desktop', 'tablet', 'mobile']) {
    const ticket = await prisma.ticket.create({ data: { ticketNumber: `BROWSER-${viewport}`, requesterId: requester.id, ticketOwnerId: staff.id, categoryId: category.id, currentStatus: 'IN_PROGRESS', summary: 'Restore the network adapter', description: 'Synthetic isolated browser fixture' } });
    ids[viewport] = ticket.id;
  }
  const apiPort = await availablePort(), browserPort = await availablePort();
  const env = { ...process.env, PORT: String(apiPort), API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${browserPort}`, WORKFLOW_BROWSER_TICKET_IDS: JSON.stringify(ids),
    WORKFLOW_BROWSER_STAFF_EMAIL: staff.email, WORKFLOW_BROWSER_REQUESTER_EMAIL: requester.email,
    WORKFLOW_BROWSER_PASSWORD: password,
  };
  start(['--import', 'tsx', 'src/server.ts'], join(workspace, 'server'), env);
  start(['node_modules/vite/bin/vite.js', 'client', '--host', '127.0.0.1', '--port', String(browserPort), '--strictPort'], workspace, env);
  await Promise.all([ready(`http://127.0.0.1:${apiPort}/api/health`), ready(env.PLAYWRIGHT_BASE_URL)]);
  const tests = start(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.workflow.config.ts'], workspace, env);
  process.exitCode = await new Promise((accept, reject) => { tests.once('error', reject); tests.once('exit', code => accept(code ?? 1)); });
  // Independent DB assertions after all browser writes; not inferred from UI text.
  for (const id of Object.values(ids)) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    const completed = await prisma.actionTaken.count({ where: { ticketId: id, status: 'COMPLETED' } });
    const statuses = await prisma.ticketWorkflowEvent.findMany({ where: { ticketId: id, kind: 'STATUS' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (process.exitCode === 0 && (ticket.currentStatus !== 'IN_PROGRESS' || ticket.resolvedAt !== null || !ticket.reopenedAt || completed !== 1 || statuses.length !== 3)) throw new Error('Browser result did not reconcile with stored ticket/actions/history.');
  }
  if (process.exitCode === 0) console.log('Browser results reconciled with real ticket/action/workflow rows.');
} finally {
  for (const child of children.reverse()) if (child.exitCode === null) child.kill();
  await prisma.$disconnect();
}
