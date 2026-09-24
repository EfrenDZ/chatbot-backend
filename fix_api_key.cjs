const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  await prisma.botConfig.update({
    where: { accountId },
    data: {
      apiHeaders: {
        'x-api-key': 'aguacero-bot-token-secreto-123'
      }
    }
  });
  console.log("Updated apiHeaders with correct fallback key");
}
main().finally(() => prisma.$disconnect());
