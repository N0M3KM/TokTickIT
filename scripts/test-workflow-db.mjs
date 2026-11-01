import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

// This runner never uses DATABASE_URL from the user's environment or .env.
// Only a fresh, temporary cluster with a generated password is eligible.
const workspace = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'toktickit-workflow-'));
const port = await new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close(() => resolvePort(address.port));
  });
});
const password = randomBytes(24).toString('hex');
const databaseName = 'workflow_test';
const database = new EmbeddedPostgres({
  databaseDir: directory, user: 'postgres', password, port,
  persistent: true, createPostgresUser: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {}, onError: message => {
    // Generated-cluster logs have no application data; redact its password.
    console.error(String(message).replaceAll(password, '[generated-password]'));
  },
});
const environment = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}?schema=public`,
  JWT_SECRET: randomBytes(32).toString('hex'), NODE_ENV: 'test',
  WORKFLOW_TEST_DATABASE: 'isolated-runner',
};
function run(arguments_, cwd = workspace) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, arguments_, { cwd, env: environment, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => resolveExit(code ?? 1));
  });
}
let started = false;
try {
  console.log('Initializing disposable PostgreSQL 16 cluster (loopback only).');
  await database.initialise();
  await database.start(); started = true;
  await database.createDatabase(databaseName);
  // Exercise the additive increment on populated Lab 3 data, not only an empty
  // database. Copy migration input files; never move or rewrite the real history.
  const baseline = await mkdtemp(join(tmpdir(), 'toktickit-workflow-baseline-'));
  await mkdir(join(baseline, 'migrations'));
  await copyFile(join(workspace, 'server/prisma/schema.prisma'), join(baseline, 'schema.prisma'));
  const migrations = await readdir(join(workspace, 'server/prisma/migrations'), { withFileTypes: true });
  for (const migration of migrations.filter(entry => entry.isDirectory() && entry.name < '20261030000000_lab4_actions_workflow')) {
    await mkdir(join(baseline, 'migrations', migration.name));
    await copyFile(join(workspace, 'server/prisma/migrations', migration.name, 'migration.sql'), join(baseline, 'migrations', migration.name, 'migration.sql'));
  }
  console.log('Applying prior migrations to isolated workflow_test database.');
  const baselineExit = await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', join(baseline, 'schema.prisma')]);
  if (baselineExit !== 0) throw new Error('Isolated baseline migration failed.');
  const client = database.getPgClient(databaseName, '127.0.0.1');
  await client.connect();
  try {
    const user = await client.query(`INSERT INTO "User" (name,email,"passwordHash",role,"mustChangePassword","updatedAt") VALUES ('Migration fixture','migration@test.invalid','synthetic-preserved-hash','REQUESTER',false,'2026-09-30 12:34:56') RETURNING id`);
    const category = await client.query(`INSERT INTO "Category" (name) VALUES ('Migration preservation fixture') RETURNING id`);
    const ticket = await client.query(`INSERT INTO "Ticket" ("ticketNumber","requesterId","categoryId",summary,description,"currentStatus","updatedAt") VALUES ('MIGRATION-PRESERVED',$1,$2,'Keep existing summary','Keep existing description','RESOLVED','2026-09-30 12:34:56') RETURNING id`, [user.rows[0].id, category.rows[0].id]);
    const ticketId = ticket.rows[0].id;
    await client.query(`INSERT INTO "Attachment" ("ticketId","originalFilename","storageFilename","mimeType","sizeBytes","updatedAt") VALUES ($1,'fixture.txt','migration-fixture-storage.txt','text/plain',12,'2026-09-30 12:34:56')`, [ticketId]);
    const oldFields = `SELECT u."passwordHash",t."ticketNumber",t.summary,t.description,t."requesterId",t."updatedAt",a."storageFilename",a."ticketId" FROM "Ticket" t JOIN "User" u ON u.id=t."requesterId" JOIN "Attachment" a ON a."ticketId"=t.id WHERE t.id=$1`;
    const before = await client.query(oldFields, [ticketId]);
    console.log('Applying additive Lab 4 migration to populated synthetic data.');
    const migrated = await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'server/prisma/schema.prisma']);
    if (migrated !== 0) throw new Error('Isolated database migration failed.');
    const after = await client.query(oldFields, [ticketId]);
    if (JSON.stringify(before.rows) !== JSON.stringify(after.rows)) throw new Error('Migration changed existing fixture data.');
    const backfill = await client.query(`SELECT version,"resolutionTimeEstimated","resolvedAt" = TIMESTAMPTZ '2026-09-30 12:34:56+00' AS "correctEstimate", (SELECT count(*)::int FROM "ActionTaken" WHERE "ticketId"=$1) AS actions, (SELECT count(*)::int FROM "TicketWorkflowEvent" WHERE "ticketId"=$1) AS events FROM "Ticket" WHERE id=$1`, [ticketId]);
    const result = backfill.rows[0];
    if (result.version !== 1 || !result.resolutionTimeEstimated || !result.correctEstimate || result.actions !== 0 || result.events !== 0) throw new Error('Legacy resolution migration/backfill evidence failed.');
    console.log('Populated migration preserved ticket, password hash and attachment relationship; UTC legacy estimate verified, no fabricated work/history.');
  } finally { await client.end(); }
  const separator = process.argv.indexOf('--');
  const customCommand = separator >= 0 ? process.argv.slice(separator + 1) : [];
  process.exitCode = customCommand.length
    ? await run(customCommand)
    : await run(['../node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.workflow-db.config.ts'], join(workspace, 'server'));
} catch (error) {
  console.error(error instanceof Error ? error.message.replaceAll(password, '[generated-password]') : 'Isolated database runner failed.');
  process.exitCode = 1;
} finally {
  if (started) await database.stop();
  // Temporary test cluster retained in the OS temp directory for diagnosis.
  console.log('Disposable PostgreSQL stopped. No configured application database was touched.');
}
