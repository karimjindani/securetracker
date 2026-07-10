import { PrismaClient } from '@prisma/client';
import { seedBaselineOrganizations } from '../scripts/test-data-utils.js';

const prisma = new PrismaClient();

async function main() {
  await seedBaselineOrganizations(prisma);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
