import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.organization.upsert({
    where: { name: 'NBP' },
    update: {},
    create: { name: 'NBP', organizationType: 'NBP' }
  });
  await prisma.organization.upsert({
    where: { name: 'Paysys Labs' },
    update: {},
    create: { name: 'Paysys Labs', organizationType: 'PAYSYS' }
  });
  await prisma.organization.upsert({
    where: { name: 'Apprise' },
    update: {},
    create: { name: 'Apprise', organizationType: 'VENDOR' }
  });
  await prisma.organization.upsert({
    where: { name: 'Auditor' },
    update: {},
    create: { name: 'Auditor', organizationType: 'AUDITOR' }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
