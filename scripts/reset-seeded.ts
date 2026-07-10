import { PrismaClient } from '@prisma/client';
import { resetToSeededData } from './test-data-utils.js';

const prisma = new PrismaClient();

resetToSeededData(prisma)
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
