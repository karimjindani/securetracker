import { PrismaClient } from '@prisma/client';
import { seedBaselineData } from '../scripts/test-data-utils.js';

const prisma = new PrismaClient();

async function main() {
  await seedBaselineData(prisma);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
