const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  for (const n of graph.nodes) {
    if (n.type === 'WEBHOOK') {
      console.log(n.id, n.url, "headers:", n.headers);
    }
  }
}
main().finally(() => prisma.$disconnect());
