const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  let graph = config.flowGraph;

  const node = graph.nodes.find(n => n.id === 'node-final-success');
  if (node) {
      node.text = node.text.replace('{{webhook.codigo_rastreo}}', '{{codigo_rastreo}}');
      if (node.messages && node.messages.length > 0) {
          node.messages[0] = node.messages[0].replace('{{webhook.codigo_rastreo}}', '{{codigo_rastreo}}');
      }
  }

  await prisma.botConfig.update({ where: { accountId: config.accountId }, data: { flowGraph: graph } });
  console.log("Patched node-final-success to use {{codigo_rastreo}}");
}
main().finally(() => prisma.$disconnect());
