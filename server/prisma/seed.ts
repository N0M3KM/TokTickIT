import { PrismaClient } from '@prisma/client';
import { IT_REQUEST_CATEGORY_NAMES } from './category-seed-data.js';

const prisma = new PrismaClient();

async function main() {
  for (const name of IT_REQUEST_CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

