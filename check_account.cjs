const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const session = await prisma.conversationSession.findFirst({ orderBy: { updatedAt: 'desc' } });
  console.log("Session accountId:", session.accountId);
  
  const botConfig = await prisma.botConfig.findUnique({ where: { accountId: session.accountId } });
  const graph = botConfig.flowGraph;
  const node = graph.nodes.find(n => n.id === 'node-add-wh');
  console.log("Is node-add-wh in graph?", !!node);
}
main().finally(() => prisma.$disconnect());
