import { PrismaClient } from '@prisma/client';
import { cleanupRegressionData } from './test-data-utils.js';

const prisma = new PrismaClient();

cleanupRegressionData(prisma)
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
