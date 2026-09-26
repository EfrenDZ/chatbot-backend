const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const node = account.botConfig.flowGraph.nodes.find(n => n.id === "node-1790113848738");
  console.log(JSON.stringify(node, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
