const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const node = account.botConfig.flowGraph.nodes.find(n => n.type === "WEBHOOK" && n.url === "/pedidos");
  console.log(node.payloadTemplate);
}
main().catch(console.error).finally(() => prisma.$disconnect());
