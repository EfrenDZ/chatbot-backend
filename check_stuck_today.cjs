const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
  const sessions = await prisma.conversationSession.findMany({
    where: { updatedAt: { gte: cutoff } },
    orderBy: { updatedAt: 'desc' }
  });
  console.log("Sessions updated in last 24h:", sessions.length);
  if (sessions.length > 0) {
    console.log(JSON.stringify(sessions.map(s => ({id: s.id, status: s.status, currentNodeId: s.currentNodeId, updatedAt: s.updatedAt})), null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
