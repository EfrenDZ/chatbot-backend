const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  const nodes = graph.nodes.filter(n => n.variableName === 'cantidad' || (n.text && n.text.includes('vas a querer')));
  console.log("Matching nodes:", JSON.stringify(nodes, null, 2));
}
main().finally(() => prisma.$disconnect());
