import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  // Active Development Requesters (≥4 required)
  // ------------------------------------------------------------------
  const activeRequesters = [
    { name: 'Somchai Jaidee',    email: 'somchai.j@example.com',   isActive: true },
    { name: 'Nattaporn Srisuk',  email: 'nattaporn.s@example.com', isActive: true },
    { name: 'Wiroj Tanaka',      email: 'wiroj.t@example.com',     isActive: true },
    { name: 'Araya Phongphan',   email: 'araya.p@example.com',     isActive: true },
  ] as const;

  for (const requester of activeRequesters) {
    await prisma.devRequester.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester,
    });
  }
  console.log(`  ✓ ${activeRequesters.length} active dev requesters seeded`);

  // ------------------------------------------------------------------
  // Inactive Development Requester (exactly 1 required — BR-04, BR-05)
  // Must NOT appear in the active requester dropdown.
  // ------------------------------------------------------------------
  await prisma.devRequester.upsert({
    where: { email: 'prayut.m@example.com' },
    update: { name: 'Prayut Mahachai', isActive: false },
    create: { name: 'Prayut Mahachai', email: 'prayut.m@example.com', isActive: false },
  });
  console.log('  ✓ 1 inactive dev requester seeded (Prayut Mahachai)');

  console.log('Seeding complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
