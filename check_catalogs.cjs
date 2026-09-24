const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  const nodes = graph.nodes.filter(n => n.type === 'DYNAMIC_MENU');
  console.log("Catalog nodes:", JSON.stringify(nodes.map(n => ({ id: n.id, target: n.targetNodeId })), null, 2));
}
main().finally(() => prisma.$disconnect());
