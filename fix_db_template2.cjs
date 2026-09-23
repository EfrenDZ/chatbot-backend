const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  const graph = config.flowGraph;
  
  for (const node of graph.nodes) {
    if (node.type === 'WEBHOOK' && node.url === '/pedidos') {
      node.payloadTemplate = node.payloadTemplate.replace('{{sender.name}}', '{{nombre}}');
    }
  }

  await prisma.botConfig.update({ where: { accountId }, data: { flowGraph: graph } });
}

main().finally(() => prisma.$disconnect());
