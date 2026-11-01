import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

// This script refuses any configured application database. The parent runner
// supplies fresh cluster credentials and a dedicated workflow_test database.
const sourceUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner'
  || !['127.0.0.1', 'localhost'].includes(sourceUrl.hostname)
  || sourceUrl.pathname !== '/workflow_test') throw new Error('Use npm run test:seed-recovery with the isolated runner.');
const workspace = resolve(import.meta.dirname, '..');
const run = promisify(execFile);
const source = new PrismaClient();
const models = [
  ['category', 'Category'], ['relatedSystem', 'RelatedSystem'], ['user', 'User'], ['ticket', 'Ticket'],
  ['attachment', 'Attachment'], ['publicComment', 'PublicComment'], ['internalNote', 'InternalNote'],
  ['actionTaken', 'ActionTaken'], ['actionRevision', 'ActionRevision'], ['ticketWorkflowEvent', 'TicketWorkflowEvent'],
];
const check = (condition, message) => { if (!condition) throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value);
async function snapshot(client) {
  const data = {};
  for (const [delegate] of models) data[delegate] = await client[delegate].findMany({ orderBy: { id: 'asc' } });
  return JSON.parse(canonical(data));
}
const counts = data => Object.fromEntries(models.map(([delegate]) => [delegate, data[delegate].length]));
async function seed() {
  const result = await run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/prisma/seed.ts'], {
    cwd: workspace, env: process.env, windowsHide: true,
  });
  check(result.stdout.includes('Seeding complete.'), 'Seed did not report completion.');
}
function preserveRows(before, after, label) {
  for (const [delegate] of models) for (const row of before[delegate]) {
    check(canonical(after[delegate].find(candidate => candidate.id === row.id)) === canonical(row), `${label}: existing ${delegate} row changed.`);
  }
}
async function coverage() {
  const tickets = await source.ticket.findMany({ where: { ticketNumber: { startsWith: 'LAB4-DEMO-' } } });
  check(new Set(tickets.map(row => row.currentStatus)).size === 8, 'Missing demo ticket statuses.');
  check(new Set(tickets.map(row => row.itPriority)).size === 4, 'Missing demo ticket priorities.');
  const actions = await source.actionTaken.findMany({ where: { ticketId: { in: tickets.map(row => row.id) } } });
  check(new Set(actions.map(row => row.status)).size === 4, 'Missing demo action statuses.');
  const emptyRequester = await source.user.findUniqueOrThrow({ where: { email: 'lab4.requester-empty@example.test' } });
  check(await source.ticket.count({ where: { requesterId: emptyRequester.id } }) === 0, 'Empty demo requester has tickets.');
  const open = tickets.find(row => row.ticketNumber === 'LAB4-DEMO-OPEN');
  const openActions = actions.filter(row => row.ticketId === open.id);
  check(openActions.length > 1 && new Set(openActions.map(row => row.performedById)).size > 1, 'Multiple-performer fixture missing.');
  check(actions.some(row => row.performedById !== row.assigneeId), 'Performer/assignee distinction missing.');
  check(actions.some(row => row.followUpRequired && row.status !== 'CANCELLED'), 'Follow-up blocking fixture missing.');
  const inactive = await source.user.findUniqueOrThrow({ where: { email: 'lab4.staff-inactive@example.test' } });
  check(actions.some(row => row.assigneeId === inactive.id && row.status === 'COMPLETED'), 'Inactive historical assignee fixture missing.');
  const legacy = tickets.find(row => row.ticketNumber === 'LAB4-DEMO-LEGACY-RESOLVED');
  check(legacy.resolutionTimeEstimated && legacy.resolvedAt && actions.every(row => row.ticketId !== legacy.id), 'Legacy estimate fixture must have no fabricated actions.');
  check(await source.ticketWorkflowEvent.count({ where: { ticketId: { in: tickets.map(row => row.id) } } }) === 0, 'Seed fabricated workflow history.');
  check(await source.actionRevision.count({ where: { actionId: { in: actions.map(row => row.id) }, eventType: 'CREATE' } }) === actions.length, 'New actions need exactly one CREATE revision.');
  return { demoTickets: tickets.length, demoActions: actions.length, ticketStatuses: 8, priorities: 4, actionStatuses: 4 };
}

let restored;
const recoveryName = `workflow_recovery_${randomBytes(6).toString('hex')}`;
check(/^workflow_recovery_[a-f0-9]{12}$/.test(recoveryName), 'Unsafe generated recovery database name.');
let createdRecovery = false;
try {
  const baseline = await snapshot(source);
  await seed(); const initial = await snapshot(source); preserveRows(baseline, initial, 'First seed');
  const fixtureCoverage = await coverage();

  // Deliberately edit real seeded snapshots before the second seed. No password,
  // account policy, active flag, assignment, ticket or action may be reset.
  const changedPassword = await bcrypt.hash('Preserved@987!', 12);
  const editedUser = await source.user.update({ where: { email: 'lab4.staff-a@example.test' }, data: {
    name: 'Owner-edited staff name', role: 'ADMINISTRATOR', isActive: false, mustChangePassword: true, passwordHash: changedPassword,
  } });
  await source.user.update({ where: { email: 'admin@example.com' }, data: { name: 'Preserved old admin', role: 'IT_STAFF', isActive: false, mustChangePassword: true, passwordHash: changedPassword } });
  await source.category.update({ where: { name: 'Network' }, data: { isActive: false } });
  await source.relatedSystem.update({ where: { name: 'Campus Wi-Fi' }, data: { isActive: false } });
  const editedTicket = await source.ticket.update({ where: { ticketNumber: 'LAB4-DEMO-OPEN' }, data: {
    summary: 'Owner-edited demo ticket', description: 'Owner-edited content', itPriority: 'CRITICAL', version: 9,
    updatedAt: new Date('2026-10-01T12:34:56.789Z'), ticketOwnerId: editedUser.id,
  } });
  const editedAction = await source.actionTaken.findFirstOrThrow({ where: { ticketId: editedTicket.id, status: 'PLANNED' }, orderBy: { id: 'asc' } });
  await source.$transaction(async tx => {
    const action = await tx.actionTaken.update({ where: { id: editedAction.id }, data: { description: 'Owner-edited action', version: 2, followUpRequired: false, followUpNote: null } });
    await tx.actionRevision.create({ data: { actionId: action.id, version: 2, editorId: action.updatedById, eventType: 'EDIT', snapshot: {
      actionAt: action.actionAt.toISOString(), description: action.description, result: action.result, performedById: action.performedById,
      assigneeId: action.assigneeId, updatedById: action.updatedById, followUpRequired: false, followUpNote: null,
      attachmentNotes: action.attachmentNotes, status: action.status, cancellationReason: action.cancellationReason,
    } } });
  });
  const beforeSecond = await snapshot(source);
  await seed(); const afterSecond = await snapshot(source);
  check(canonical(counts(beforeSecond)) === canonical(counts(afterSecond)), 'Repeated seed changed table counts.');
  check(canonical(beforeSecond) === canonical(afterSecond), 'Repeated seed changed existing data/password/history/timestamps.');
  console.log(`Two-seed verification passed: ${canonical(fixtureCoverage)}; edited accounts, reference flags, ticket/action snapshots and append-only revisions preserved.`);

  const directory = await mkdtemp(join(tmpdir(), 'toktickit-seed-recovery-'));
  const sourceFiles = join(directory, 'source-files'); const backupFiles = join(directory, 'backup-files'); const restoredFiles = join(directory, 'restored-files');
  await Promise.all([sourceFiles, backupFiles, restoredFiles].map(path => mkdir(path)));
  const storageFilename = 'synthetic-recovery-attachment.txt'; const content = Buffer.from('TokTickIT synthetic attachment recovery fixture\n', 'utf8');
  await writeFile(join(sourceFiles, storageFilename), content);
  await source.attachment.create({ data: { ticketId: editedTicket.id, originalFilename: 'recovery-fixture.txt', storageFilename,
    mimeType: 'text/plain', sizeBytes: content.length } });

  // A whitelisted logical JSON archive, not pg_dump. This environment's embedded
  // Windows distribution omits pg_dump/pg_restore; no large client download is used.
  const backup = await source.$transaction(tx => snapshot(tx), { isolationLevel: 'RepeatableRead' });
  const backupPath = join(directory, 'database.logical.json');
  await writeFile(backupPath, canonical({ format: 'toktickit-logical-v1', tables: backup }), 'utf8');
  await copyFile(join(sourceFiles, storageFilename), join(backupFiles, storageFilename));
  const start = performance.now();
  await source.$executeRawUnsafe(`CREATE DATABASE "${recoveryName}"`); createdRecovery = true;
  const restoredUrl = new URL(sourceUrl); restoredUrl.pathname = `/${recoveryName}`;
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'server/prisma/schema.prisma'], {
    cwd: workspace, env: { ...process.env, DATABASE_URL: restoredUrl.toString() }, windowsHide: true,
  });
  restored = new PrismaClient({ datasources: { db: { url: restoredUrl.toString() } } });
  const archive = JSON.parse(await readFile(backupPath, 'utf8'));
  check(archive.format === 'toktickit-logical-v1' && Object.keys(archive.tables).length === models.length, 'Invalid logical archive format.');
  await restored.$transaction(async tx => {
    for (const [delegate, table] of models) {
      check(Array.isArray(archive.tables[delegate]), 'Missing allowlisted logical table.');
      if (archive.tables[delegate].length) await tx[delegate].createMany({ data: archive.tables[delegate] });
      // Table names are hardcoded above, never read from the archive or user data.
      await tx.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'), COALESCE((SELECT MAX("id") FROM "${table}"),1), EXISTS(SELECT 1 FROM "${table}"))`);
    }
  }, { timeout: 20000 });
  await copyFile(join(backupFiles, storageFilename), join(restoredFiles, storageFilename));
  const recovered = await snapshot(restored);
  check(canonical(backup) === canonical(recovered), 'Separate database restore changed rows, IDs, timestamps, hashes or relationships.');
  const restoredAccount = await restored.user.findUniqueOrThrow({ where: { id: editedUser.id } });
  check(await bcrypt.compare('Preserved@987!', restoredAccount.passwordHash), 'Recovered password hash failed verification.');
  const restoredAttachment = await restored.attachment.findUniqueOrThrow({ where: { storageFilename } });
  check(restoredAttachment.ticketId === editedTicket.id && restoredAttachment.sizeBytes === content.length, 'Recovered attachment relationship changed.');
  const fileHash = hash(await readFile(join(restoredFiles, storageFilename)));
  check(fileHash === hash(content), 'Recovered synthetic attachment hash mismatch.');
  const oldMax = Math.max(...recovered.category.map(row => row.id));
  check((await restored.category.create({ data: { name: 'Post-restore sequence verification' } })).id > oldMax, 'Recovered sequence could reuse an existing ID.');
  console.log(canonical({ result: 'PASS', backupFormat: 'whitelisted logical JSON + migrated schema; not pg_dump',
    seedRuns: 2, counts: counts(backup), dataSha256: hash(canonical(backup)), syntheticAttachmentSha256: fileHash,
    restoredRowsAndRelationshipsEqual: true, passwordHashVerified: true, sequenceVerified: true,
    recoveryMs: Number((performance.now() - start).toFixed(2)), artifactsDirectory: directory,
    limitation: 'Native pg_dump/pg_restore tools absent; this is a tested application logical backup/restore format, not native dump compatibility certification.' }));
} catch (error) {
  // Prisma and assertion details may contain fixture password hashes; keep output safe.
  console.error(error instanceof Error && error.name === 'Error' ? error.message : 'Seed/recovery verification failed; inspect the local synthetic fixture with developer tools.');
  process.exitCode = 1;
} finally {
  if (restored) await restored.$disconnect();
  if (createdRecovery) await source.$executeRawUnsafe(`DROP DATABASE "${recoveryName}"`);
  await source.$disconnect();
}
