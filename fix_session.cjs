const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.conversationSession.updateMany({
    where: { currentNodeId: "node-1790113848738" },
    data: { currentNodeId: "node-root" }
  });
  console.log("Sessions reset");
}
main().catch(console.error).finally(() => prisma.$disconnect());
