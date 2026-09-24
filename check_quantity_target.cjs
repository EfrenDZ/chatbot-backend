const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  const qNode = graph.nodes.find(n => n.variableName === 'cantidad');
  console.log("Quantity node:", JSON.stringify(qNode, null, 2));
  
  const loopNode = graph.nodes.find(n => n.id === 'node-cart-loop');
  console.log("Loop node:", JSON.stringify(loopNode, null, 2));

  const ticketNode = graph.nodes.find(n => n.id === 'node-cart-ticket');
  console.log("Ticket node:", JSON.stringify(ticketNode, null, 2));
}
main().finally(() => prisma.$disconnect());
