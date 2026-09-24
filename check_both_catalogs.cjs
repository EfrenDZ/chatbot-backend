const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  const c1 = graph.nodes.find(n => n.id === 'node-1790115871394');
  const c2 = graph.nodes.find(n => n.id === 'node-red-catalog');
  console.log("C1 (returning):", JSON.stringify(c1, null, 2));
  console.log("C2 (new):", JSON.stringify(c2, null, 2));
}
main().finally(() => prisma.$disconnect());
