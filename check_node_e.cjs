const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  const node = graph.nodes.find(n => n.id === "node-e-1790113889755");
  console.log("Error node:", JSON.stringify(node, null, 2));
}
main().finally(() => prisma.$disconnect());
