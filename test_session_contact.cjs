const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const session = await prisma.conversationSession.findFirst({
    where: { accountId: "93e076e9-c540-4c1e-afe7-267d55c52856" },
    orderBy: { updatedAt: 'desc' }
  });
  console.log("Session contactIdentifier:", session?.contactIdentifier);
}
main().finally(() => prisma.$disconnect());
