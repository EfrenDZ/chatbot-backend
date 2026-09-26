const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const session = await prisma.conversationSession.findFirst({
    orderBy: { updatedAt: 'desc' }
  });
  console.log("Current Node:", session.currentNodeId);
  console.log("Status:", session.status);
  console.log("Metadata:", JSON.stringify(session.sessionMetadata, null, 2));
}
main().finally(() => prisma.$disconnect());
