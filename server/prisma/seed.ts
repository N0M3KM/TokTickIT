import { PrismaClient, type ActionStatus, type Priority, type TicketStatus, type UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Seeding database...');

  // ------------------------------------------------------------------
  // Categories (4 required)
  // ------------------------------------------------------------------
  const categoryNames = [
    'Account and Access',
    'Hardware',
    'Software',
    'Network',
  ] as const;

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
  }
  console.log(`  ✓ ${categoryNames.length} categories seeded`);

  // ------------------------------------------------------------------
  // Related Systems (≥6 required)
  // ------------------------------------------------------------------
  const relatedSystemNames = [
    'Email',
    'Campus Wi-Fi',
    'VPN',
    'LEB2 App',
    'Grade Submission App',
    'Printer',
    'Corporate Laptop',
  ] as const;

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
  }
  console.log(`  ✓ ${relatedSystemNames.length} related systems seeded`);

  // ------------------------------------------------------------------
  // Users — Lab 3 real authentication
  //
  // SECURITY NOTE: These credentials are for LOCAL DEVELOPMENT only.
  // Do NOT use these passwords in any production environment.
  //
  // Seeded credentials:
  //   Requesters (role=REQUESTER, mustChangePassword=true): Change@123
  //   IT Staff   (role=IT_STAFF,  mustChangePassword=false): Staff@123!
  //   Admin      (role=ADMINISTRATOR, mustChangePassword=false): Admin@123!
  // ------------------------------------------------------------------

  const requesterHash = await bcrypt.hash('Change@123', BCRYPT_ROUNDS);
  const staffHash     = await bcrypt.hash('Staff@123!', BCRYPT_ROUNDS);
  const adminHash     = await bcrypt.hash('Admin@123!', BCRYPT_ROUNDS);

  // Active Requesters (≥4)
  const requesters = [
    { name: 'Somchai Jaidee',   email: 'somchai.j@example.com',   isActive: true  },
    { name: 'Nattaporn Srisuk', email: 'nattaporn.s@example.com', isActive: true  },
    { name: 'Wiroj Tanaka',     email: 'wiroj.t@example.com',     isActive: true  },
    { name: 'Araya Phongphan',  email: 'araya.p@example.com',     isActive: true  },
    { name: 'Prayut Mahachai',  email: 'prayut.m@example.com',    isActive: false }, // inactive
  ];

  for (const r of requesters) {
    await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: {
        name: r.name,
        email: r.email,
        passwordHash: requesterHash,
        role: 'REQUESTER',
        isActive: r.isActive,
        mustChangePassword: true,
      },
    });
  }
  console.log(`  ✓ ${requesters.length} requester accounts seeded (4 active, 1 inactive)`);

  // Active IT Staff (≥3)
  const itStaff = [
    { name: 'Michael Brown', email: 'michael.b@example.com', isActive: true  },
    { name: 'Sarah Johnson', email: 'sarah.j@example.com',   isActive: true  },
    { name: 'David Lee',     email: 'david.l@example.com',   isActive: true  },
    { name: 'Kevin Patel',   email: 'kevin.p@example.com',   isActive: false }, // inactive
  ];

  for (const s of itStaff) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        passwordHash: staffHash,
        role: 'IT_STAFF',
        isActive: s.isActive,
        mustChangePassword: false,
      },
    });
  }
  console.log(`  ✓ ${itStaff.length} IT Staff accounts seeded (3 active, 1 inactive)`);

  // Administrator (≥1 active)
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: adminHash,
      role: 'ADMINISTRATOR',
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log('  ✓ 1 Administrator account seeded');

  await seedLab4({ requester: requesterHash, staff: staffHash, admin: adminHash });

  console.log('Seeding complete.');
}

/** Stable local-only fixture keys. Existing snapshots and accounts are never reset. */
async function seedLab4(hashes: { requester: string; staff: string; admin: string }) {
  const identity = async (key: string, name: string, role: UserRole, isActive = true) => prisma.user.upsert({
    where: { email: `lab4.${key}@example.test` }, update: {}, create: { name, email: `lab4.${key}@example.test`, role, isActive,
      passwordHash: hashes[role === 'REQUESTER' ? 'requester' : role === 'ADMINISTRATOR' ? 'admin' : 'staff'],
      mustChangePassword: role === 'REQUESTER' },
  });
  const requester = await identity('requester', 'Lab 4 Requester', 'REQUESTER');
  await identity('requester-empty', 'Lab 4 Requester with no tickets', 'REQUESTER');
  const staffA = await identity('staff-a', 'Lab 4 Staff A', 'IT_STAFF');
  const staffB = await identity('staff-b', 'Lab 4 Staff B', 'IT_STAFF');
  const inactive = await identity('staff-inactive', 'Lab 4 Inactive Staff', 'IT_STAFF', false);
  await identity('admin', 'Lab 4 Administrator', 'ADMINISTRATOR');
  const category = await prisma.category.findUniqueOrThrow({ where: { name: 'Network' } });
  const system = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: 'Campus Wi-Fi' } });
  const now = new Date(); const createdAt = new Date(now.getTime() - 10 * 86400000);
  const actionAt = new Date(now.getTime() - 86400000);
  const bangkok = new Date(now.getTime() + 7 * 3600000); bangkok.setUTCHours(0, 0, 0, 0); bangkok.setUTCDate(bangkok.getUTCDate() - 6);
  const boundary = new Date(bangkok.getTime() - 7 * 3600000);
  const statuses: TicketStatus[] = ['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','RESOLVED','CLOSED','REOPENED','CANCELLED'];
  const priorities: Priority[] = ['LOW','MEDIUM','HIGH','CRITICAL'];
  const tickets: Record<string, { id: number }> = {};
  for (const [index, status] of statuses.entries()) {
    tickets[status] = await prisma.ticket.upsert({ where: { ticketNumber: `LAB4-DEMO-${status}` }, update: {}, create: {
      ticketNumber: `LAB4-DEMO-${status}`, requesterId: requester.id, ticketOwnerId: status === 'NEW' ? null : staffA.id,
      categoryId: category.id, relatedSystemId: system.id, summary: `Lab 4 ${status.toLowerCase().replaceAll('_', ' ')} example`,
      description: 'Synthetic local demonstration ticket. Do not enter real private information.',
      currentStatus: status, requestedPriority: priorities[index % 4], itPriority: priorities[index % 4],
      createdAt, ticketDate: createdAt, updatedAt: now,
      resolvedAt: ['RESOLVED','CLOSED'].includes(status) ? new Date(now.getTime() - 3600000) : null,
      reopenedAt: status === 'REOPENED' ? new Date(now.getTime() - 1800000) : null,
    } });
  }
  for (const [suffix, updatedAt] of [['FROM', boundary], ['BEFORE', new Date(boundary.getTime() - 1)], ['ASOF', now]] as const) {
    await prisma.ticket.upsert({ where: { ticketNumber: `LAB4-DEMO-BOUNDARY-${suffix}` }, update: {}, create: {
      ticketNumber: `LAB4-DEMO-BOUNDARY-${suffix}`, requesterId: requester.id, categoryId: category.id,
      summary: `Lab 4 initial seed boundary ${suffix.toLowerCase()}`, description: 'Synthetic date-boundary demonstration; live window changes with time.',
      currentStatus: 'OPEN', createdAt, ticketDate: createdAt, updatedAt,
    } });
  }
  await prisma.ticket.upsert({ where: { ticketNumber: 'LAB4-DEMO-LEGACY-RESOLVED' }, update: {}, create: {
    ticketNumber: 'LAB4-DEMO-LEGACY-RESOLVED', requesterId: requester.id, ticketOwnerId: staffA.id, categoryId: category.id,
    summary: 'Lab 4 estimated legacy resolution', description: 'Synthetic legacy example with no fabricated action or workflow history.',
    currentStatus: 'RESOLVED', createdAt, ticketDate: createdAt, updatedAt: actionAt, resolvedAt: actionAt, resolutionTimeEstimated: true,
  } });
  const addAction = async (key: string, parent: string, status: ActionStatus, performer = staffA.id, assignee = staffB.id, followUp = false) => {
    const hex = createHash('sha256').update(`TokTickIT/lab4/${key}`).digest('hex');
    const idempotencyKey = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
    await prisma.$transaction(async tx => {
      const ticketId = tickets[parent].id;
      if (await tx.actionTaken.findUnique({ where: { performedById_ticketId_idempotencyKey: { performedById: performer, ticketId, idempotencyKey } } })) return;
      const action = await tx.actionTaken.create({ data: { ticketId, performedById: performer, assigneeId: assignee, updatedById: performer,
        actionAt, description: `Synthetic Lab 4 ${key.replaceAll('-', ' ')} work`, status,
        result: status === 'COMPLETED' ? 'Synthetic verification completed.' : null,
        followUpRequired: followUp, followUpNote: followUp ? 'Arrange a synthetic follow-up appointment.' : null,
        attachmentNotes: 'Reference ticket attachments when available; no files are generated by the seed.',
        cancellationReason: status === 'CANCELLED' ? 'Synthetic duplicate work is no longer needed.' : null,
        idempotencyKey, requestFingerprint: createHash('sha256').update(`seed-only:${key}`).digest('hex'),
        createdAt: actionAt,
      } });
      await tx.actionRevision.create({ data: { actionId: action.id, version: 1, editorId: performer, eventType: 'CREATE', snapshot: {
        actionAt: action.actionAt.toISOString(), description: action.description, result: action.result,
        performedById: performer, assigneeId: assignee, updatedById: performer, status,
        followUpRequired: followUp, followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes, cancellationReason: action.cancellationReason,
      } } });
    });
  };
  await addAction('planned-follow-up', 'OPEN', 'PLANNED', staffA.id, staffB.id, true);
  await addAction('second-planned', 'OPEN', 'PLANNED', staffB.id, staffA.id);
  await addAction('in-progress', 'IN_PROGRESS', 'IN_PROGRESS');
  await addAction('completed-work', 'IN_PROGRESS', 'COMPLETED', staffB.id, staffA.id);
  await addAction('cancelled-follow-up', 'OPEN', 'CANCELLED', staffA.id, staffB.id, true);
  await addAction('resolved-completed', 'RESOLVED', 'COMPLETED');
  await addAction('closed-inactive-history', 'CLOSED', 'COMPLETED', inactive.id, inactive.id);
  console.log('  Lab 4 stable demo fixtures inserted where missing; existing values preserved.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
