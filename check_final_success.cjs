const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  const s = graph.nodes.find(n => n.id === 'node-final-success');
  console.log("Success node:", JSON.stringify(s, null, 2));
}
main().finally(() => prisma.$disconnect());
