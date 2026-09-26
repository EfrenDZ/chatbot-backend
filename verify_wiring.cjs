const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  
  const qNew = graph.nodes.find(n => n.id === 'node-red-quantity');
  console.log("qNew target:", qNew?.targetNodeId);

  const qRet = graph.nodes.find(n => n.id === 'node-1790115906983');
  console.log("qRet target:", qRet?.targetNodeId);

  const loop = graph.nodes.find(n => n.id === 'node-cart-loop');
  console.log("loop options:", JSON.stringify(loop?.options));

  const ticket = graph.nodes.find(n => n.id === 'node-cart-ticket');
  console.log("ticket target:", ticket?.targetNodeId);
}
main().finally(() => prisma.$disconnect());
