import { PrismaClient } from '@prisma/client';
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
      update: { isActive: true },
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
      update: { isActive: true },
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
      update: { name: r.name, isActive: r.isActive, role: 'REQUESTER' },
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
      update: { name: s.name, isActive: s.isActive, role: 'IT_STAFF' },
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
    update: { name: 'Admin User', isActive: true, role: 'ADMINISTRATOR' },
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

  console.log('Seeding complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
